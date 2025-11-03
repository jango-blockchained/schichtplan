# AI Integration Debugging & Error Handling Improvements

## Overview

This document highlights the debugging and error handling improvements made to the AI integration system.

## Key Debugging Enhancements

### 1. Comprehensive Error Logging

#### Backend Improvements

**Before:**
```python
# Generic error handling
try:
    result = await process_request()
except Exception as e:
    logger.error(f"Error: {e}")
    raise
```

**After:**
```python
# Detailed error context with exc_info
try:
    result = await process_request()
except ValidationError as e:
    logger.error(f"Validation error in continue_conversation: {e}")
    return {"error": f"Validation error: {str(e)}"}
except ValueError as e:
    logger.error(f"Value error in continue_conversation: {e}")
    return {"error": str(e)}
except Exception as e:
    logger.error(f"Failed to continue conversation: {e}", exc_info=True)
    return {"error": f"Internal error: {str(e)}", "conversation_id": conversation_id}
```

**Benefits:**
- Stack traces included with `exc_info=True`
- Specific exception types handled differently
- Error context preserved in response
- Graceful degradation instead of crashes

#### Frontend Improvements

**Before:**
```typescript
try {
  const result = await fetch(url);
} catch (error) {
  console.error('Request failed', error);
}
```

**After:**
```typescript
try {
  const result = await fetch(url);
} catch (error) {
  if (error instanceof Error) {
    if (error.name !== 'AbortError') {
      console.error('Stream error:', error);
      yield {
        type: 'error',
        error: error.message || 'Streaming failed'
      };
    }
  } else {
    yield {
      type: 'error',
      error: 'Unknown streaming error'
    };
  }
}
```

**Benefits:**
- Distinguishes between error types
- Ignores expected errors (AbortError)
- Provides user-friendly error messages
- Maintains error context in stream

### 2. Retry Attempt Logging

**Backend:**
```python
@retry_async(retryable_exceptions=(Exception,), config=AI_REQUEST_RETRY_CONFIG)
async def process_with_ai():
    logger.debug(f"Attempting AI request for conversation {conversation_id}")
    return await ai_circuit_breaker.call(
        self._process_conversational_input,
        context,
        user_input,
        additional_context,
    )
```

**Frontend:**
```typescript
const result = await retryAsync(
  async () => await fetch(url, options),
  DEFAULT_RETRY_CONFIG,
  (attempt, error) => {
    console.warn(
      `Chat request retry attempt ${attempt + 1}`,
      error
    );
  }
);
```

**Output Example:**
```
WARNING: Request failed (attempt 1/4). Retrying in 2.3s...
WARNING: Request failed (attempt 2/4). Retrying in 4.7s...
INFO: Request succeeded on attempt 3
```

### 3. Circuit Breaker State Tracking

**Backend:**
```python
# Automatic logging in circuit breaker
class CircuitBreaker:
    async def call(self, func, *args, **kwargs):
        if self._state == "OPEN":
            logger.warning("Circuit breaker is OPEN - request blocked")
            raise Exception("Circuit breaker is OPEN")
        
        try:
            result = await func(*args, **kwargs)
            if self._state == "HALF_OPEN":
                logger.info("Circuit breaker closed after successful call")
            return result
        except Exception as e:
            self._failure_count += 1
            if self._failure_count >= self.failure_threshold:
                logger.error(f"Circuit breaker opened after {self._failure_count} failures")
            raise
```

**Frontend:**
```typescript
// Health status monitoring
const health = enhancedAIService.getHealthStatus();
console.log('Circuit Breaker:', health.circuitBreaker); // CLOSED, OPEN, HALF_OPEN
```

**Output Example:**
```
WARNING: Circuit breaker is OPEN - request blocked
INFO: Circuit breaker entering HALF_OPEN state
INFO: Circuit breaker closed after successful call
ERROR: Circuit breaker opened after 5 failures
```

### 4. Rate Limit Diagnostics

**Backend:**
```python
# Detailed rate limit checking
rate_limit_result = await rate_limiter.check_rate_limit(
    user_id=user_id,
    conversation_id=conversation_id,
    estimated_tokens=len(user_input) * 2
)

if not rate_limit_result["allowed"]:
    logger.warning(
        f"Rate limit exceeded for user {user_id}: {rate_limit_result['reason']}"
    )
    return {
        "error": "Rate limit exceeded",
        "reason": rate_limit_result["reason"],
        "retry_after": rate_limit_result["retry_after"],
        "limits": rate_limit_result["limits"]
    }

# Statistics tracking
stats = rate_limiter.get_statistics(user_id=user_id)
logger.info(f"Rate limiter stats: {stats}")
```

**Output Example:**
```json
{
  "global": {
    "requests": 150,
    "tokens": 75000
  },
  "user": {
    "requests": 25,
    "tokens": 12500
  },
  "active_users": 10,
  "active_conversations": 15
}
```

### 5. Validation Error Details

**Backend:**
```python
from src.backend.utils.ai_validation import validate_ai_request, ValidationError

try:
    validated = validate_ai_request(
        message=user_input,
        conversation_id=conversation_id,
        context=additional_context
    )
except ValidationError as e:
    logger.error(f"Validation error: {e}")
    # Error includes which field failed and why
    return {"error": f"Invalid input: {str(e)}"}
```

**Validation Error Examples:**
```
ValidationError: Message exceeds maximum length of 10000 characters
ValidationError: Conversation ID contains invalid characters
ValidationError: Context size exceeds maximum of 100000 characters
ValidationError: Invalid UUID format for conversation ID
ValidationError: Message cannot be empty
```

### 6. Tool Execution Debugging

**Backend:**
```python
async def _execute_tool_calls(self, context, tool_calls):
    # Log tool execution plan
    self.logger.info(
        f"Executing {len(independent_tools)} independent tools in parallel"
    )
    self.logger.info(
        f"Executing {len(dependent_tools)} dependent tools sequentially"
    )
    
    # Individual tool logging
    for tool_call in tool_calls:
        try:
            result = await execute_with_retry(tool_call)
            self.logger.debug(f"Tool {tool_call.name} succeeded")
        except Exception as e:
            self.logger.error(
                f"Tool call {tool_call.name} failed after retries: {e}"
            )
```

**Output Example:**
```
INFO: Executing 3 independent tools in parallel
DEBUG: Tool analyze_schedule_conflicts succeeded
DEBUG: Tool get_schedule_statistics succeeded
DEBUG: Tool get_coverage_requirements succeeded
INFO: Executing 1 dependent tools sequentially
WARNING: Tool optimize_schedule_ai attempt 1 failed: Timeout. Retrying in 2.0s...
DEBUG: Tool optimize_schedule_ai succeeded on attempt 2
```

### 7. Connection Pool Health Monitoring

**Backend:**
```python
# Health checks with detailed status
health_status = await pool_manager.health_check()

logger.info(f"Connection pool health: {health_status}")
# Output: {'redis': True, 'database': True}

# Automatic health check loop with logging
async def _health_check_loop(self):
    while True:
        try:
            await self._client.ping()
            if not self._is_healthy:
                self._is_healthy = True
                logger.info("Redis connection pool health restored")
        except Exception as e:
            if self._is_healthy:
                self._is_healthy = False
                logger.error(f"Redis health check failed: {e}")
```

### 8. Stream Processing Debugging

**Frontend:**
```typescript
// Detailed stream chunk validation
try {
  const parsedChunk = JSON.parse(data);
  const validatedChunk = validateStreamChunk(parsedChunk);
  yield validatedChunk;
} catch (error) {
  console.warn('Failed to parse or validate SSE data:', data, error);
  // Continue processing other chunks
}
```

**Output Example:**
```
WARN: Failed to parse SSE data: {"invalid": true
WARN: ValidationError: Stream chunk missing type field
DEBUG: Stream chunk validated successfully: {type: 'content', content: '...'}
```

### 9. Request Deduplication Tracking

**Frontend:**
```typescript
async deduplicate(endpoint, params, fn) {
  const key = this.getCacheKey(endpoint, params);
  
  if (this.cache.has(key) && !this.isExpired(key)) {
    console.debug(`Using cached request for ${endpoint}`);
    return this.cache.get(key);
  }
  
  console.debug(`Executing new request for ${endpoint}`);
  // ... rest of implementation
}
```

### 10. Health Status API

**Frontend:**
```typescript
// Complete service health monitoring
const health = enhancedAIService.getHealthStatus();

console.log('=== Enhanced AI Service Health ===');
console.log('Circuit Breaker:', health.circuitBreaker);
console.log('Rate Limiter:', health.rateLimiter.availableTokens, 'tokens available');
console.log('Active Streams:', health.activeStreams);
console.log('Active Tasks:', health.activeTasks);
```

**Output Example:**
```
=== Enhanced AI Service Health ===
Circuit Breaker: CLOSED
Rate Limiter: 18.7 tokens available
Active Streams: 2
Active Tasks: 1
```

## Debugging Workflows

### Diagnosing Failed AI Requests

1. **Check validation errors:**
   ```
   ERROR: Validation error: Message exceeds maximum length
   ```
   → User input too long

2. **Check rate limits:**
   ```
   WARNING: Rate limit exceeded: User user123 request rate limit exceeded
   ```
   → User making too many requests

3. **Check circuit breaker:**
   ```
   ERROR: Circuit breaker opened after 5 failures
   ```
   → AI service is down or consistently failing

4. **Check retry attempts:**
   ```
   WARNING: Request failed (attempt 3/4). Retrying in 8.2s...
   ```
   → Transient failure, automatic recovery in progress

5. **Check connection pools:**
   ```
   ERROR: Redis health check failed: Connection refused
   ```
   → Infrastructure issue with Redis

### Performance Debugging

**Tool Execution Time:**
```
INFO: Executing 5 independent tools in parallel
DEBUG: Parallel execution completed in 2.3s
DEBUG: Sequential execution completed in 1.5s
DEBUG: Total tool execution time: 3.8s
```

**Cache Hit Ratio:**
```
DEBUG: Using cached request for /chat (hit)
DEBUG: Executing new request for /chat (miss)
Cache hit ratio: 67%
```

**Rate Limiter Utilization:**
```
INFO: Rate limiter stats: {
  "global": {"requests": 150, "tokens": 75000},
  "capacity_used": "75%"
}
```

## Error Recovery Procedures

### 1. Circuit Breaker Recovery
```python
# Backend
circuit_breaker.reset()

# Frontend
enhancedAIService.reset()
```

### 2. Rate Limit Reset
```python
# Backend - reset specific user
await rate_limiter.reset_limits(user_id="user123")

# Backend - reset global limits
await rate_limiter.reset_limits()

# Frontend
enhancedAIService.rateLimiter.reset()
```

### 3. Connection Pool Recovery
```python
# Check health
health = await pool_manager.health_check()

# Reinitialize if needed
if not health["redis"]:
    await pool_manager.redis_pool.close()
    await pool_manager.initialize_redis(url=REDIS_URL)
```

### 4. Cache Cleanup
```python
# Backend - automatic cleanup
await rate_limiter.cleanup_old_buckets()

# Frontend - manual cleanup
enhancedAIService.requestCache.clear()
enhancedAIService.clearExpiredCache()
```

## Monitoring Best Practices

1. **Set up log aggregation** (e.g., ELK stack, Datadog)
2. **Monitor error rates** for circuit breaker activations
3. **Track rate limit rejections** per user/conversation
4. **Alert on connection pool health failures**
5. **Monitor retry success rates**
6. **Track cache hit ratios**
7. **Monitor tool execution performance**
8. **Set up dashboards** for real-time health status

## Common Issues & Solutions

| Issue | Log Pattern | Solution |
|-------|-------------|----------|
| Validation failures | `ValidationError: Message exceeds...` | Enforce client-side limits |
| Rate limit exceeded | `Rate limit exceeded: User...` | Implement request queuing |
| Circuit breaker open | `Circuit breaker opened after...` | Check AI service health |
| Connection failures | `Redis health check failed` | Verify infrastructure |
| Retry exhaustion | `failed after 3 attempts` | Investigate root cause |
| Cache memory leak | Growing memory usage | Enable periodic cleanup |
| Stream interruptions | `Stream error: ...` | Check network stability |
| Tool execution slow | High tool execution times | Optimize parallel execution |

## Testing Debugging Features

### Simulate Failures
```python
# Backend - force circuit breaker open
for _ in range(5):
    try:
        await circuit_breaker.call(lambda: raise_exception())
    except:
        pass

# Check state
assert circuit_breaker.state == "OPEN"
```

### Test Rate Limiting
```python
# Backend - exhaust rate limit
for _ in range(21):
    result = await rate_limiter.check_rate_limit(user_id="test")
    
# 21st request should be denied
assert not result["allowed"]
```

### Test Retry Logic
```typescript
// Frontend - test retry with mock failures
let attempts = 0;
const result = await retryAsync(
  async () => {
    attempts++;
    if (attempts < 3) throw new Error('Temporary failure');
    return 'success';
  },
  DEFAULT_RETRY_CONFIG
);

assert(result === 'success');
assert(attempts === 3);
```

## Conclusion

These debugging improvements provide:
- **Visibility** into system behavior
- **Diagnostics** for troubleshooting
- **Context** for error resolution
- **Metrics** for performance optimization
- **Recovery** mechanisms for resilience

All improvements follow logging best practices and provide actionable information for debugging production issues.

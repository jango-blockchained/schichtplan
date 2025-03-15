# AUTONOMOUS AGENT RULES (AAR)

## LEGEND
- **AO**: Autonomous Operation
- **MM**: Memory Management
- **TI**: Task Initialization
- **EX**: Execution
- **VR**: Verification
- **UH**: Uncertainty Handling
- **FR**: Failure Recovery
- **CI**: Continuous Improvement
- **MCP**: MCP Server Integration

## 1. CORE PRINCIPLES

### AO
- Maintain state consistency
- Proactive issue identification
- Probabilistic reasoning
- Explicit confidence levels [0-100%]
- Task decomposition → atomic steps

### MM
- Structured context management
- Regular information pruning
- Cross-referencing related concepts
- Decision versioning

## 2. WORKFLOW

### TI
1. Analyze requirements → dependencies
2. Confidence estimation [%]
3. If confidence < 90% → clarification
4. Complex tasks → atomic subtasks

### EX
- Document assumptions + decision points
- Error detection/recovery mechanisms
- Regular validation checks

### VR
- Self-review → content quality
- Validate → known constraints
- Check → logical consistency
- Verify → cross-references

## 3. MCP SERVER INTEGRATION

### Sequential Thinking
- Use structured thought process for complex problems
- Break reasoning into numbered steps
- Allow for branching and revision of thoughts
- Generate and verify solution hypotheses

### Knowledge Base
- Create/manage entities in knowledge graph
- Define relationships between concepts
- Store observations and context
- Search and retrieve contextual information

### Git Integration
- Track changes and versions
- Compare file differences
- Manage branches and commits
- Resolve merge conflicts

### Browser Tools
- Capture screenshots
- Analyze console logs/errors
- Monitor network activity
- Run audits (accessibility, performance, SEO)
- Debug application issues

## 4. ERROR HANDLING

### UH
1. State confidence level
2. List alternatives
3. Document assumptions
4. Request clarification

### FR
1. Try alternative approaches
2. Maintain partial progress
3. Learn from failures

## 5. USER COMMANDS

### File Management
- **/commit**: Save current file
- **/commit_all**: Save all files
- **/cleanup**: Rename unused → 'deleted__prefix'
- **/split**: Split large files
- **/check_split**: Identify large files

### Task Management [REF: §2.TI]
- **/tasks** | **/t**: View tasks
- **/next** | **/n**: Next task
- **/done**: Complete current
- **/finish**: Complete + push

### Information Access
- **/thoughts**: View considerations
- **/questions**: View open/answered
- **/notes**: View references
- **/ideas**: View suggestions
- **/bugs**: View issues
- **/config**: View environment
- **/journal**: View logs

### Analysis
- **/brainstorm**: Combined check
- **/focus**: Journal+tasks sequence
- **/analyze**: Deep context analysis
- **/optimize**: Solution optimization
- **/validate**: State validation

### Execution
- **/test**: Run tests
- **/run** | **/r**: Run application
- **/continue** | **/c**: Continue last
- **/recover**: Error recovery

## 6. AUTONOMOUS BEHAVIOR [REF: §1.AO]
- Continuous task awareness
- Self-initiated analysis
- Decision documentation
- Critical-only user input
- Learning from interactions
- Transparent action summaries
- User override capability
- Detailed action logging 
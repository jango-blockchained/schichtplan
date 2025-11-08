"""
Connection pool manager for Redis and database connections.

Provides connection pooling, health checks, and automatic reconnection
for improved performance and reliability.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

logger = logging.getLogger(__name__)


class RedisConnectionPool:
    """Manages Redis connection pool with health checks."""

    def __init__(
        self,
        url: str = "redis://localhost:6379",
        max_connections: int = 50,
        socket_timeout: float = 5.0,
        socket_connect_timeout: float = 5.0,
        retry_on_timeout: bool = True,
        health_check_interval: float = 30.0,
    ):
        """Initialize Redis connection pool.

        Args:
            url: Redis connection URL
            max_connections: Maximum number of connections in pool
            socket_timeout: Socket timeout in seconds
            socket_connect_timeout: Socket connect timeout in seconds
            retry_on_timeout: Whether to retry on timeout
            health_check_interval: Seconds between health checks
        """
        self.url = url
        self.max_connections = max_connections
        self.socket_timeout = socket_timeout
        self.socket_connect_timeout = socket_connect_timeout
        self.retry_on_timeout = retry_on_timeout
        self.health_check_interval = health_check_interval

        self._pool: aioredis.ConnectionPool | None = None
        self._client: aioredis.Redis | None = None
        self._health_check_task: asyncio.Task | None = None
        self._is_healthy = False

    async def initialize(self):
        """Initialize the connection pool."""
        if self._pool is not None:
            logger.warning("Redis pool already initialized")
            return

        try:
            self._pool = aioredis.ConnectionPool.from_url(
                self.url,
                max_connections=self.max_connections,
                socket_timeout=self.socket_timeout,
                socket_connect_timeout=self.socket_connect_timeout,
                retry_on_timeout=self.retry_on_timeout,
                decode_responses=True,
            )

            self._client = aioredis.Redis(connection_pool=self._pool)

            # Test connection
            await self._client.ping()
            self._is_healthy = True

            # Start health check task
            self._health_check_task = asyncio.create_task(self._health_check_loop())

            logger.info(
                f"Redis connection pool initialized with {self.max_connections} max connections"
            )

        except Exception as e:
            logger.error(f"Failed to initialize Redis connection pool: {e}")
            self._is_healthy = False
            raise

    async def close(self):
        """Close the connection pool."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

        if self._client:
            await self._client.close()

        if self._pool:
            await self._pool.disconnect()

        self._pool = None
        self._client = None
        self._is_healthy = False

        logger.info("Redis connection pool closed")

    @property
    def is_healthy(self) -> bool:
        """Check if connection pool is healthy."""
        return self._is_healthy

    def get_client(self) -> aioredis.Redis:
        """Get Redis client from pool.

        Returns:
            Redis client

        Raises:
            RuntimeError: If pool not initialized
        """
        if not self._client:
            raise RuntimeError("Redis pool not initialized")

        return self._client

    async def _health_check_loop(self):
        """Background task for periodic health checks."""
        while True:
            try:
                await asyncio.sleep(self.health_check_interval)

                if self._client:
                    await self._client.ping()
                    if not self._is_healthy:
                        self._is_healthy = True
                        logger.info("Redis connection pool health restored")

            except asyncio.CancelledError:
                break
            except Exception as e:
                if self._is_healthy:
                    self._is_healthy = False
                    logger.error(f"Redis health check failed: {e}")

    async def execute(self, command: str, *args, **kwargs) -> Any:
        """Execute Redis command with error handling.

        Args:
            command: Redis command name
            *args: Command arguments
            **kwargs: Command keyword arguments

        Returns:
            Command result

        Raises:
            RuntimeError: If pool not initialized or unhealthy
        """
        if not self._client:
            raise RuntimeError("Redis pool not initialized")

        if not self._is_healthy:
            logger.warning("Executing command on unhealthy Redis connection")

        try:
            method = getattr(self._client, command)
            return await method(*args, **kwargs)
        except Exception as e:
            logger.error(f"Redis command '{command}' failed: {e}")
            self._is_healthy = False
            raise


class DatabaseConnectionPool:
    """Manages async database connection pool."""

    def __init__(
        self,
        database_url: str,
        pool_size: int = 20,
        max_overflow: int = 10,
        pool_timeout: float = 30.0,
        pool_recycle: int = 3600,
        pool_pre_ping: bool = True,
        echo: bool = False,
    ):
        """Initialize database connection pool.

        Args:
            database_url: Database connection URL
            pool_size: Number of connections to maintain in pool
            max_overflow: Maximum overflow connections beyond pool_size
            pool_timeout: Timeout for getting connection from pool
            pool_recycle: Recycle connections after this many seconds
            pool_pre_ping: Test connections before using
            echo: Echo SQL queries (for debugging)
        """
        self.database_url = database_url
        self.pool_size = pool_size
        self.max_overflow = max_overflow
        self.pool_timeout = pool_timeout
        self.pool_recycle = pool_recycle
        self.pool_pre_ping = pool_pre_ping
        self.echo = echo

        self._engine = None
        self._session_factory = None

    def initialize(self):
        """Initialize the connection pool."""
        if self._engine is not None:
            logger.warning("Database pool already initialized")
            return

        try:
            # Determine pool class based on database type
            if "sqlite" in self.database_url:
                # SQLite doesn't support connection pooling
                poolclass = NullPool
                pool_size = 0
                max_overflow = 0
            else:
                poolclass = QueuePool
                pool_size = self.pool_size
                max_overflow = self.max_overflow

            self._engine = create_async_engine(
                self.database_url,
                poolclass=poolclass,
                pool_size=pool_size,
                max_overflow=max_overflow,
                pool_timeout=self.pool_timeout,
                pool_recycle=self.pool_recycle,
                pool_pre_ping=self.pool_pre_ping,
                echo=self.echo,
            )

            self._session_factory = sessionmaker(
                self._engine, class_=AsyncSession, expire_on_commit=False
            )

            logger.info(
                f"Database connection pool initialized with pool_size={pool_size}"
            )

        except Exception as e:
            logger.error(f"Failed to initialize database connection pool: {e}")
            raise

    async def close(self):
        """Close the connection pool."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None
            logger.info("Database connection pool closed")

    @asynccontextmanager
    async def get_session(self):
        """Get database session from pool.

        Yields:
            AsyncSession instance

        Raises:
            RuntimeError: If pool not initialized
        """
        if not self._session_factory:
            raise RuntimeError("Database pool not initialized")

        session = self._session_factory()
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    async def health_check(self) -> bool:
        """Perform database health check.

        Returns:
            True if healthy, False otherwise
        """
        try:
            async with self.get_session() as session:
                await session.execute("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False


class ConnectionPoolManager:
    """Central manager for all connection pools."""

    def __init__(self):
        """Initialize connection pool manager."""
        self.redis_pool: RedisConnectionPool | None = None
        self.db_pool: DatabaseConnectionPool | None = None

    async def initialize_redis(
        self,
        url: str = "redis://localhost:6379",
        max_connections: int = 50,
        **kwargs,
    ):
        """Initialize Redis connection pool.

        Args:
            url: Redis connection URL
            max_connections: Maximum connections in pool
            **kwargs: Additional Redis configuration
        """
        if self.redis_pool:
            logger.warning("Redis pool already initialized")
            return

        self.redis_pool = RedisConnectionPool(
            url=url, max_connections=max_connections, **kwargs
        )
        await self.redis_pool.initialize()

    def initialize_database(self, database_url: str, pool_size: int = 20, **kwargs):
        """Initialize database connection pool.

        Args:
            database_url: Database connection URL
            pool_size: Connection pool size
            **kwargs: Additional database configuration
        """
        if self.db_pool:
            logger.warning("Database pool already initialized")
            return

        self.db_pool = DatabaseConnectionPool(
            database_url=database_url, pool_size=pool_size, **kwargs
        )
        self.db_pool.initialize()

    async def close_all(self):
        """Close all connection pools."""
        if self.redis_pool:
            await self.redis_pool.close()
            self.redis_pool = None

        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None

        logger.info("All connection pools closed")

    async def health_check(self) -> dict[str, bool]:
        """Check health of all connection pools.

        Returns:
            Dictionary with health status of each pool
        """
        health_status = {}

        if self.redis_pool:
            health_status["redis"] = self.redis_pool.is_healthy
        else:
            health_status["redis"] = None

        if self.db_pool:
            health_status["database"] = await self.db_pool.health_check()
        else:
            health_status["database"] = None

        return health_status


# Global connection pool manager instance
_connection_pool_manager = ConnectionPoolManager()


def get_connection_pool_manager() -> ConnectionPoolManager:
    """Get global connection pool manager instance.

    Returns:
        ConnectionPoolManager instance
    """
    return _connection_pool_manager

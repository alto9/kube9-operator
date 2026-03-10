# Messaging (Async)

## Event Queue (Internal)
- Event emission is non-blocking
- Async queue buffers events
- Background worker writes to SQLite
- Prevents operator logic from blocking on event storage

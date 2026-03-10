# Data Consistency

## Data Lifecycle Phases

### Phase 1: Raw Data Collection (Current)
- M8 data collectors gather raw data from cluster resources
- Stored locally in operator pod
- No data leaves cluster

## Design Principles

- **Separation of concerns**: Collection and storage have distinct responsibility
- **Privacy by default**: Raw data never leaves cluster

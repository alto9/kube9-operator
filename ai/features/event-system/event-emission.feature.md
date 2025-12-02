---
feature_id: event-recording
spec_id: [event-recorder-spec, event-types-spec, kubernetes-event-watching-spec]
context_id: [nodejs-async-patterns, kubernetes-watch-api]
---

# Event Recording Feature

## Overview

The operator must watch and record events from multiple sources including Kubernetes Events, cluster state changes, and workload activities. Events are collected from external sources, normalized, and stored in SQLite for historical analysis. The operator also records its own lifecycle events as supplementary context.

## Behavior

```gherkin
Feature: Event Recording

Background:
  Given the operator has an EventRecorder service
  And the EventRecorder watches Kubernetes Event objects
  And the EventRecorder watches cluster resource changes
  And the EventRecorder maintains an async queue
  And a background worker processes the queue
  And events are written to SQLite database

Scenario: Record Kubernetes Event for Pod failure
  Given a Pod named "nginx" in namespace "default" fails
  When Kubernetes creates an Event object with reason "BackOff"
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field            | Value                                  |
    | event_type       | cluster                                |
    | severity         | warning                                |
    | title            | Pod BackOff                            |
    | description      | Back-off restarting failed container nginx |
    | object_kind      | Pod                                    |
    | object_namespace | default                                |
    | object_name      | nginx                                  |
    | metadata         | {"reason": "BackOff", "count": 3}      |
  And the event should be added to the async queue
  And the operator should continue immediately without waiting

Scenario: Record Kubernetes Event for Node NotReady
  Given a Node named "worker-3" becomes NotReady
  When Kubernetes creates an Event with reason "NodeNotReady"
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field       | Value                                  |
    | event_type  | cluster                                |
    | severity    | critical                               |
    | title       | Node NotReady                          |
    | description | Node worker-3 is not ready             |
    | object_kind | Node                                   |
    | object_name | worker-3                               |
  And the event should be marked as critical severity

Scenario: Record Node added to cluster
  Given the cluster has 3 worker nodes
  When a new Node named "worker-4" joins the cluster
  And the EventRecorder detects the Node addition
  Then it should record an event with:
    | Field       | Value                          |
    | event_type  | cluster                        |
    | severity    | info                           |
    | title       | Node added to cluster          |
    | description | New node worker-4 joined the cluster |
    | object_kind | Node                           |
    | object_name | worker-4                       |
    | metadata    | {"cpu": "4", "memory": "16Gi", "zone": "us-west-1a"} |

Scenario: Record Namespace deletion
  Given a Namespace named "staging" exists
  When the Namespace is deleted
  And the EventRecorder detects the deletion
  Then it should record an event with:
    | Field       | Value                          |
    | event_type  | cluster                        |
    | severity    | warning                        |
    | title       | Namespace deleted              |
    | description | Namespace staging was deleted  |
    | object_kind | Namespace                      |
    | object_name | staging                        |

Scenario: Record Deployment scaled up
  Given a Deployment "nginx" in namespace "default" has 2 replicas
  When the Deployment is scaled to 5 replicas
  And the EventRecorder detects the scale event
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | cluster                        |
    | severity         | info                           |
    | title            | Deployment scaled              |
    | description      | Deployment nginx scaled from 2 to 5 replicas |
    | object_kind      | Deployment                     |
    | object_namespace | default                        |
    | object_name      | nginx                          |
    | metadata         | {"previous_replicas": 2, "new_replicas": 5} |

Scenario: Record ImagePullBackOff event
  Given a Pod is trying to pull image "nginx:invalid-tag"
  When Kubernetes creates an Event with reason "Failed" and message "ImagePullBackOff"
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | cluster                        |
    | severity         | error                          |
    | title            | Image pull failed              |
    | description      | Failed to pull image nginx:invalid-tag |
    | object_kind      | Pod                            |
    | object_namespace | default                        |
    | object_name      | web-app                        |
    | metadata         | {"reason": "ImagePullBackOff", "image": "nginx:invalid-tag"} |

Scenario: Record CrashLoopBackOff event
  Given a Pod container is crashing repeatedly
  When Kubernetes creates an Event with reason "BackOff" and increasing count
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field       | Value                          |
    | event_type  | cluster                        |
    | severity    | error                          |
    | title       | Container crash loop           |
    | description | Container in Pod web-app is crash looping |
    | metadata    | {"reason": "CrashLoopBackOff", "restart_count": 5, "last_exit_code": 1} |

Scenario: Watch and record Kubernetes Events continuously
  Given the operator is running
  When the EventRecorder starts watching Kubernetes Event objects
  Then it should establish a watch on core/v1/Event
  And it should handle watch events (ADDED, MODIFIED, DELETED)
  And it should normalize Event data into internal event format
  And it should add normalized events to the async queue
  And the watch should automatically reconnect on failure

Scenario: Filter duplicate Kubernetes Events
  Given a Pod is repeatedly crash looping
  When Kubernetes creates multiple Events with the same reason "CrashLoopBackOff"
  And the Events have incrementing count values
  And the EventRecorder detects these Events
  Then it should record only unique state changes
  And it should update metadata with latest count
  And it should NOT create duplicate events for every count increment

Scenario: Correlate events with operator insights
  Given the operator generates an insight about missing resource limits on Deployment "nginx"
  When recording the insight as an event
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | insight                        |
    | severity         | warning                        |
    | title            | Missing resource limits        |
    | description      | Deployment nginx has no resource limits |
    | object_kind      | Deployment                     |
    | object_namespace | default                        |
    | object_name      | nginx                          |
    | metadata         | {"insight_id": "insight_abc123", "category": "resource_management"} |
  And the event should reference the related insight ID

Scenario: Record ResourceQuota exceeded event
  Given a Namespace "production" has a ResourceQuota limiting CPU to 10 cores
  When a Pod tries to be scheduled that would exceed the quota
  And Kubernetes creates an Event with reason "FailedCreate"
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | cluster                        |
    | severity         | warning                        |
    | title            | Resource quota exceeded        |
    | description      | Cannot schedule Pod: CPU quota exceeded |
    | object_kind      | ResourceQuota                  |
    | object_namespace | production                     |
    | metadata         | {"quota_limit": "10", "requested": "12", "resource": "cpu"} |

Scenario: Record PersistentVolumeClaim binding failure
  Given a PVC "data-volume" in namespace "default" is pending
  When Kubernetes cannot find a matching PV
  And Kubernetes creates an Event with reason "FailedBinding"
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | cluster                        |
    | severity         | error                          |
    | title            | PVC binding failed             |
    | description      | No PersistentVolume matches PVC data-volume |
    | object_kind      | PersistentVolumeClaim          |
    | object_namespace | default                        |
    | object_name      | data-volume                    |
    | metadata         | {"storage_class": "fast-ssd", "requested_size": "100Gi"} |

Scenario: Record OOMKilled container event
  Given a container is running without memory limits
  When the container is killed due to out-of-memory
  And Kubernetes creates an Event with reason "OOMKilled"
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | cluster                        |
    | severity         | critical                       |
    | title            | Container OOM killed           |
    | description      | Container killed due to out of memory |
    | object_kind      | Pod                            |
    | object_namespace | default                        |
    | object_name      | memory-hog                     |
    | metadata         | {"container": "app", "reason": "OOMKilled"} |

Scenario: Record HPA scaling event
  Given an HPA is configured for Deployment "web-app"
  When the HPA scales the deployment due to high CPU usage
  And Kubernetes creates an Event with reason "SuccessfulRescale"
  And the EventRecorder detects the Event
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | cluster                        |
    | severity         | info                           |
    | title            | HPA scaled deployment          |
    | description      | HPA scaled web-app from 3 to 7 replicas due to CPU usage |
    | object_kind      | HorizontalPodAutoscaler        |
    | object_namespace | default                        |
    | object_name      | web-app-hpa                    |
    | metadata         | {"previous": 3, "new": 7, "metric": "cpu", "value": "85%"} |

Scenario: Record Service endpoint changes
  Given a Service "api-gateway" has endpoints
  When backend Pods become unavailable
  And Kubernetes updates the Service endpoints
  And the EventRecorder detects significant endpoint changes (> 50% reduction)
  Then it should record an event with:
    | Field            | Value                          |
    | event_type       | cluster                        |
    | severity         | warning                        |
    | title            | Service endpoints reduced      |
    | description      | Service api-gateway lost 3 of 5 endpoints |
    | object_kind      | Service                        |
    | object_namespace | default                        |
    | object_name      | api-gateway                    |
    | metadata         | {"previous_endpoints": 5, "current_endpoints": 2} |

Scenario: Record operator lifecycle events as supplementary context
  Given the operator is starting up
  When the operator initialization completes
  Then it should record an event with:
    | Field       | Value                                  |
    | event_type  | operator                               |
    | severity    | info                                   |
    | title       | Operator started                       |
    | description | kube9-operator v1.0.0 started successfully |
    | metadata    | {"version": "1.0.0", "tier": "free"}   |
  And this event provides context for other cluster events

Scenario: Record operator health changes as supplementary context
  Given the operator is healthy
  When the operator's database becomes unavailable
  Then it should record an event with:
    | Field       | Value                          |
    | event_type  | operator                       |
    | severity    | error                          |
    | title       | Operator health degraded       |
    | description | Database connection lost       |
    | metadata    | {"previous": "healthy", "current": "degraded"} |
  And this event provides context for potential gaps in event recording

Scenario: Event recording is non-blocking
  Given the operator is watching Kubernetes Events
  When an external Kubernetes Event is detected
  Then the event should be normalized and added to the async queue
  And the function should return immediately (< 1ms)
  And the operator should continue watching without waiting
  And the background worker should process the queue independently

Scenario: Background worker processes event queue
  Given 10 recorded events are in the async queue
  When the background worker runs
  Then it should dequeue events one at a time
  And it should write each event to the SQLite database
  And it should handle database write failures gracefully
  And it should retry failed writes with exponential backoff

Scenario: Event queue overflow protection
  Given the event queue has 1000 events (maximum capacity)
  When attempting to add another recorded event
  Then the EventRecorder should log a warning
  And it should drop the oldest event (likely less critical)
  And it should add the new event to the queue
  And it should expose a metric for dropped events

Scenario: Generate sortable event IDs for recorded events
  Given a Kubernetes Event is being recorded on 2025-12-02 at 10:30:45
  When the event ID is generated for storage
  Then it should have format "evt_20251202_103045_a7f3b9"
  And the timestamp portion should be derived from current time
  And the random suffix should be 6 alphanumeric characters
  And the ID should be globally unique with high probability

Scenario: Event IDs sort chronologically
  Given events are recorded at different times from multiple sources
  When querying events ordered by ID
  Then older recorded events should have lexicographically smaller IDs
  And newer recorded events should have lexicographically larger IDs
  And the sort order should match chronological order

Scenario: Prometheus metrics for event recording
  Given the operator is recording events from multiple sources
  When Prometheus scrapes the /metrics endpoint
  Then it should expose the following metrics:
    | Metric                                  | Type      | Description                       |
    | kube9_events_total                      | Counter   | Total events recorded by type/severity |
    | kube9_events_recorded_duration_seconds  | Histogram | Time to add event to queue        |
    | kube9_events_queue_size                 | Gauge     | Current event queue size          |
    | kube9_events_dropped_total              | Counter   | Total events dropped due to overflow |
    | kube9_events_watch_errors_total         | Counter   | Kubernetes watch API errors       |
    | kube9_events_processing_duration_seconds| Histogram | Time to write event to database   |

Scenario: Event metadata size limits for recorded events
  Given a Kubernetes Event is being recorded
  When the Event's annotations or labels result in metadata JSON larger than 10KB
  Then the EventRecorder should log a warning
  And it should truncate the metadata to 10KB
  And it should add a truncation indicator to metadata
  And it should still record the event with truncated metadata

Scenario: Sanitize sensitive data in recorded events
  Given a Kubernetes Event contains annotation data
  When the Event includes fields like "password", "token", "secret", "apiKey" in annotations
  Then the EventRecorder should detect sensitive field names
  And it should redact the values with "[REDACTED]"
  And it should preserve non-sensitive metadata fields
  And it should log a warning about redaction

Scenario: Event recording during operator shutdown
  Given the operator is shutting down
  And there are 20 recorded events in the queue
  When the shutdown handler runs
  Then it should stop watching for new Kubernetes Events
  And it should flush all 20 queued events to the database
  And it should wait up to 5 seconds for queue to empty
  And it should log if any events are lost due to timeout

Scenario: Event recording performance target
  Given the operator is watching Kubernetes Events under normal cluster load
  When measuring event recording performance
  Then normalizing and adding an event to the queue should take < 1ms
  And the system should support recording 1000 events/sec throughput
  And memory usage should remain stable over time
  And there should be no memory leaks in the queue or watch connections

Scenario: Event recording during database unavailability
  Given the SQLite database is unavailable
  When Kubernetes Events are detected and added to the queue
  Then the background worker should detect database errors
  And it should retry writes with exponential backoff
  And it should log database connectivity errors
  And it should update Prometheus metrics for failed writes
  And the Kubernetes watch should continue receiving events

Scenario: Handle Kubernetes watch connection failures
  Given the EventRecorder is watching Kubernetes Events
  When the watch connection is lost due to network issues
  Then the EventRecorder should detect the watch failure
  And it should automatically reconnect with exponential backoff
  And it should resume watching from the last known resourceVersion
  And it should log watch reconnection attempts
  And it should expose metrics for watch connection health
```

## Event Types and Severity Mapping

### Cluster Events (Primary - from Kubernetes)
- **Pod failures** (CrashLoopBackOff, ImagePullBackOff, OOMKilled): **error** or **critical**
- **Node status changes** (NotReady, MemoryPressure): **warning** or **critical**
- **Resource issues** (ResourceQuota exceeded, PVC binding failures): **warning** or **error**
- **Scaling events** (HPA scaling, Deployment scaled): **info**
- **Node added/removed**: **info**
- **Namespace created/deleted**: **info** or **warning**
- **Service endpoint changes** (> 50% reduction): **warning**

### Insight Events (Generated by Operator)
- **Resource management insights**: **warning**
- **Security insights**: **warning** or **critical**
- **Best practice insights**: **info** or **warning**
- Insight acknowledged: **info**
- Insight resolved: **info**

### Assessment Events (Generated by Operator)
- Assessment started: **info**
- Assessment completed: **info**
- Pillar failure: **warning**
- Critical security finding: **critical**
- Compliance violation: **error**

### Health Events (from Kubernetes Monitoring)
- Cluster health degradation: **warning**
- Resource exhaustion warnings: **error**
- API server connectivity issues: **error**

### Operator Events (Supplementary - Operator Lifecycle)
- Startup, shutdown, restart: **info**
- Registration success: **info**
- Registration failure: **error**
- Health degradation: **warning**
- Database unavailability: **critical**

### System Events (Operator Internal)
- Collection completed: **info**
- Collection failed: **error**
- Database maintenance: **info**
- Watch connection failures: **warning**
- Unexpected errors: **error** or **critical**

## Integration Points

- **Kubernetes Watch API**: Primary source of events via Event object watching
- **Kubernetes Informers**: Watch cluster resource changes (Nodes, Namespaces, Deployments, etc.)
- **DatabaseManager**: Background worker writes recorded events to database
- **Prometheus**: Exposes metrics for event recording, watch health, and queue status
- **Insight System**: Records events when insights are generated from analysis
- **Assessment System**: Records events when assessments complete or find issues
- **Operator Lifecycle**: Records supplementary events for operator health and status

## Performance Requirements

- Event recording (normalization + queue insertion): < 1ms
- Throughput: 1000 events/sec minimum (from all sources)
- Queue capacity: 1000 events maximum
- Queue processing: < 10ms per event write to database
- Watch reconnection: Exponential backoff, max 60 seconds
- Shutdown flush: Complete within 5 seconds

## Non-Goals

- **Recording ALL Kubernetes Events** (filter to significant events only)
- **Real-time event streaming** to external systems (future enhancement)
- **Event correlation** and parent/child relationships (future enhancement)
- **Custom event types** from user-defined CRDs (future enhancement)
- **Event replay** for debugging (future enhancement)
- **Multi-cluster event aggregation** (future: kube9-server feature)
- **Forwarding to external logging systems** (future enhancement)


---
task_id: 020-update-helm-chart-for-persistent-volume
session_id: event-database-and-cli-query-interface
feature_id: [event-database-storage]
spec_id: [event-database-schema-spec]
status: completed
---

# Task: Update Helm Chart for PersistentVolume

## Objective

Update the kube9-operator Helm chart to include PersistentVolume and PersistentVolumeClaim for event database storage.

## Description

The event database (SQLite at `/data/kube9.db`) requires persistent storage. The Helm chart must be updated to provision a PersistentVolumeClaim and mount it at `/data` in the operator pod.

## Requirements

- [ ] Add PersistentVolumeClaim template
- [ ] Configure PVC size (default: 1Gi, configurable via values.yaml)
- [ ] Configure storageClass (default: "", configurable)
- [ ] Update Deployment to mount PVC at `/data`
- [ ] Add retention configuration to values.yaml (info: 7 days, critical: 30 days)
- [ ] Document PVC requirements in chart README

## Files to Modify

### 1. Create templates/persistentvolumeclaim.yaml

```yaml
{{- if .Values.persistence.enabled }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "kube9-operator.fullname" . }}-data
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
spec:
  accessModes:
    - ReadWriteOnce
  {{- if .Values.persistence.storageClass }}
  storageClassName: {{ .Values.persistence.storageClass }}
  {{- end }}
  resources:
    requests:
      storage: {{ .Values.persistence.size }}
{{- end }}
```

### 2. Update templates/deployment.yaml

Add volume and volumeMount:

```yaml
spec:
  template:
    spec:
      containers:
      - name: operator
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        volumeMounts:
        - name: data
          mountPath: /data
        env:
        - name: EVENT_RETENTION_INFO_DAYS
          value: "{{ .Values.events.retention.infoDays }}"
        - name: EVENT_RETENTION_CRITICAL_DAYS
          value: "{{ .Values.events.retention.criticalDays }}"
      volumes:
      - name: data
        {{- if .Values.persistence.enabled }}
        persistentVolumeClaim:
          claimName: {{ include "kube9-operator.fullname" . }}-data
        {{- else }}
        emptyDir: {}
        {{- end }}
```

### 3. Update values.yaml

```yaml
# Event system configuration
events:
  retention:
    # Retention period for info/warning events (days)
    infoDays: 7
    # Retention period for error/critical events (days)
    criticalDays: 30

# Persistent storage for event database
persistence:
  # Enable persistent storage for events
  enabled: true
  # Storage size for event database
  size: 1Gi
  # Storage class (leave empty for default)
  storageClass: ""
```

### 4. Update Chart README

Document the persistence requirements and configuration options.

## Acceptance Criteria

- [ ] PVC is created when `persistence.enabled=true`
- [ ] Deployment mounts PVC at `/data`
- [ ] Database file persists across pod restarts
- [ ] EmptyDir used when `persistence.enabled=false` (for testing)
- [ ] Retention configuration is configurable via Helm values
- [ ] Chart README documents persistence options

## Estimated Time

< 30 minutes

## Dependencies

None - this is configuration work, can be done anytime after schema is defined


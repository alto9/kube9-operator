---
feature_id: chart-repository-hosting
name: Helm Chart Repository Hosting
description: Automated hosting and publishing of Helm charts at charts.kube9.io with public access
spec_id:
  - chart-repository-infrastructure
  - chart-publishing-automation
---

# Helm Chart Repository Hosting

```gherkin
Scenario: Infrastructure deployed for chart hosting
  Given the kube9-operator repository
  When the infrastructure deployment workflow runs
  Then an S3 bucket should be created for chart storage
  And a CloudFront distribution should be configured for charts.kube9.io
  And a Route53 A record should point charts.kube9.io to CloudFront
  And the infrastructure should be ready to serve Helm charts

Scenario: Chart published on release
  Given a new release is created in kube9-operator repository
  When the release-chart workflow triggers
  Then the Helm chart should be packaged as a .tgz file
  And the chart should be uploaded to the S3 bucket
  And the index.yaml should be updated with the new version
  And the index.yaml should be uploaded to S3
  And the CloudFront cache should be invalidated

Scenario: User adds Helm repository
  Given the infrastructure is deployed
  And charts have been published
  When a user runs "helm repo add kube9 https://charts.kube9.io"
  Then the command should succeed
  And the index.yaml should be downloaded successfully
  And no authentication should be required

Scenario: User installs chart from repository
  Given the Helm repository is added
  When a user runs "helm install kube9-operator kube9/kube9-operator"
  Then the chart package should be downloaded from CloudFront
  And the installation should proceed without authentication
  And the operator should be deployed to the cluster

Scenario: Multiple chart versions available
  Given multiple releases have published charts
  When a user runs "helm search repo kube9"
  Then all published chart versions should be listed
  And the latest version should be clearly indicated
  And each version should show its app version

Scenario: Automatic index.yaml merging
  Given an existing index.yaml in S3 with previous versions
  When a new chart version is published
  Then the new version should be added to the index
  And all previous versions should be retained
  And the index should maintain proper structure

Scenario: CloudFront cache invalidation
  Given a new chart has been uploaded to S3
  When the CloudFront invalidation is triggered
  Then all paths should be invalidated
  And subsequent requests should receive the updated content
  And users should see the new chart version immediately

Scenario: Infrastructure independent of portal
  Given the kube9-portal repository
  When the operator infrastructure is deployed
  Then the infrastructure should not depend on portal resources
  And the infrastructure should manage its own S3 bucket
  And the infrastructure should manage its own CloudFront distribution
  And the operator should control its entire chart publishing lifecycle

Scenario: Infrastructure deployment failure handling
  Given the infrastructure deployment workflow
  When the deployment encounters an error
  Then the workflow should fail clearly
  And error messages should indicate the specific issue
  And the infrastructure should not be partially deployed
  And the deployment can be safely retried

Scenario: Chart publishing without infrastructure changes
  Given the infrastructure is already deployed
  When a release is created
  Then only the chart publishing workflow should run
  And the infrastructure should remain unchanged
  And new charts should be added to existing infrastructure

Scenario: Public access without authentication
  Given the CloudFront distribution is configured
  When a user requests any chart file
  Then no authentication should be required
  And no AWS credentials should be needed
  And the content should be served with appropriate HTTPS
  And the response should include proper caching headers

Scenario: Repository URL consistency
  Given the infrastructure is deployed
  When charts are published
  Then all charts should reference https://charts.kube9.io as the repository URL
  And the index.yaml should use the charts.kube9.io URL
  And the Chart.yaml should reference charts.kube9.io in sources

Scenario: CDN global distribution
  Given charts are stored in S3
  And CloudFront is configured
  When users from different regions request charts
  Then CloudFront should serve from edge locations
  And latency should be minimized globally
  And S3 should only be accessed for cache misses
```


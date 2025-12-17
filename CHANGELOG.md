## [1.0.3](https://github.com/alto9/kube9-operator/compare/v1.0.2...v1.0.3) (2025-12-17)


### Bug Fixes

* correct index.yaml fallback creation in chart publishing workflow ([220eeef](https://github.com/alto9/kube9-operator/commit/220eeeff1407702912a7a956b2a6b508844650ec))

## [1.0.2](https://github.com/alto9/kube9-operator/compare/v1.0.1...v1.0.2) (2025-12-17)


### Bug Fixes

* update chart repository URL to charts.kube9.io and use PAT for releases ([c498745](https://github.com/alto9/kube9-operator/commit/c49874529eff11af47bbe4fcc4c40b3aced199ef))

## [1.0.1](https://github.com/alto9/kube9-operator/compare/v1.0.0...v1.0.1) (2025-12-17)


### Bug Fixes

* trigger deployment ([1e6cf4c](https://github.com/alto9/kube9-operator/commit/1e6cf4cd12b1518149fee5e5d043ec5e125cbb62))

# 1.0.0 (2025-12-17)


### Bug Fixes

* unit tests ([7ffbc5d](https://github.com/alto9/kube9-operator/commit/7ffbc5dfe2dd37eafdaaf19c15abfe9ef4f04a0f))


### Features

* add bucketName prop and RepositoryUrl output to ChartsStack ([03bea9c](https://github.com/alto9/kube9-operator/commit/03bea9c6818456abfaa729946e0b06a0db36e7fe))
* add CDK project structure for chart repository infrastructure ([f666de3](https://github.com/alto9/kube9-operator/commit/f666de30f7d6806e2859acaded91e2db75945178))
* add chart publishing workflow ([7416cb6](https://github.com/alto9/kube9-operator/commit/7416cb610a933ce5071684a70310fc5099c30c0a))
* add Docker image publishing workflow for GHCR ([de4520d](https://github.com/alto9/kube9-operator/commit/de4520d14c847a2f19fef1256028e2d92377c45c))
* add Route53 A record for charts.kube9.io ([c8d0d34](https://github.com/alto9/kube9-operator/commit/c8d0d34337f84f75a4d750127967d3946d133d03))
* event listener and CLI query utility ([f1bd32a](https://github.com/alto9/kube9-operator/commit/f1bd32a633892800a62830e3fca0da0ee953d55f))
* implement CloudFront distribution with OAC for chart repository ([fa49b95](https://github.com/alto9/kube9-operator/commit/fa49b952b069893ad7e92761784a7e9bd42bc73b))
* implement S3 bucket for Helm chart storage ([6312750](https://github.com/alto9/kube9-operator/commit/631275016d07b0d72f86a026fe0a597bc9abcd6a))

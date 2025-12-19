## [1.0.10](https://github.com/alto9/kube9-operator/compare/v1.0.9...v1.0.10) (2025-12-19)


### Bug Fixes

* remove kubernetes version check ([ccd2e88](https://github.com/alto9/kube9-operator/commit/ccd2e88c9b73c86cf5635cafcea1435dbdacc878))

## [1.0.9](https://github.com/alto9/kube9-operator/compare/v1.0.8...v1.0.9) (2025-12-18)


### Bug Fixes

* use pod namespace instead of hardcoded kube9-system ([0f3c0ad](https://github.com/alto9/kube9-operator/commit/0f3c0ad07deb53496f2416ef9b327144ddcb4ae5))

## [1.0.8](https://github.com/alto9/kube9-operator/compare/v1.0.7...v1.0.8) (2025-12-18)


### Bug Fixes

* sync image tag with release version and update URLs to kube9.io ([30c1ed0](https://github.com/alto9/kube9-operator/commit/30c1ed0e114fedd0ab0ed2873ca0fc88f11f5690))

## [1.0.7](https://github.com/alto9/kube9-operator/compare/v1.0.6...v1.0.7) (2025-12-18)


### Bug Fixes

* update kubeVersion constraint and home URL ([e7f340b](https://github.com/alto9/kube9-operator/commit/e7f340b47029014709b866f26243922538b6e26f))

## [1.0.6](https://github.com/alto9/kube9-operator/compare/v1.0.5...v1.0.6) (2025-12-17)


### Bug Fixes

* clean up old chart packages before packaging in workflow ([9ad5313](https://github.com/alto9/kube9-operator/commit/9ad53138294155eae495a6b9b078ecdc14eaee70))

## [1.0.5](https://github.com/alto9/kube9-operator/compare/v1.0.4...v1.0.5) (2025-12-17)


### Bug Fixes

* sync Chart.yaml version with package.json during releases ([4b6863a](https://github.com/alto9/kube9-operator/commit/4b6863a32a648c46073ddd4546058a89dc0dd51a))

## [1.0.4](https://github.com/alto9/kube9-operator/compare/v1.0.3...v1.0.4) (2025-12-17)


### Bug Fixes

* simplify Docker build to linux/amd64 only and update CodeQL action ([57aee0c](https://github.com/alto9/kube9-operator/commit/57aee0c2897dc107ead1696239d4c210ba110755))

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

# [1.9.0](https://github.com/alto9/kube9-operator/compare/v1.8.0...v1.9.0) (2026-04-15)


### Bug Fixes

* **assessment:** wire spot cost check into registry and align scope ([16bcc53](https://github.com/alto9/kube9-operator/commit/16bcc53cd93d60d404d5a248c20a0cf46071a1e9))
* **ci:** prevent husky hooks from breaking Docker builds ([09b30da](https://github.com/alto9/kube9-operator/commit/09b30da028ecaf33744cb35adedb3ea612dc63e4))


### Features

* add .env.example and update documentation for local development ([96e4d13](https://github.com/alto9/kube9-operator/commit/96e4d13a91ac44b772f5b537570fc4109b4d04d2))
* **assessment:** add cost-optimization resource request/limit ratio check ([8e9fe54](https://github.com/alto9/kube9-operator/commit/8e9fe54567b312a979c6f3818898b9b7a6a7224f))
* **assessment:** add over-provisioning detection cost check ([f35c1d3](https://github.com/alto9/kube9-operator/commit/f35c1d3f9aa5a073e63b85244e9fad5e318cfe0f))
* **assessment:** add spot capacity cost-optimization check ([63708aa](https://github.com/alto9/kube9-operator/commit/63708aa5a3f9792c5c7b99749ac572fd7d2c04de))

# [1.8.0](https://github.com/alto9/kube9-operator/compare/v1.7.0...v1.8.0) (2026-04-14)


### Bug Fixes

* update Dockerfile to install production dependencies correctly ([6f3b14b](https://github.com/alto9/kube9-operator/commit/6f3b14b5db30bc5acf5dd0bd3a33e53adfd3d176))


### Features

* add .env.example and update documentation for local development ([f9ddcd4](https://github.com/alto9/kube9-operator/commit/f9ddcd47418d724d92024f0f650cfada086fc40a))

# [1.7.0](https://github.com/alto9/kube9-operator/compare/v1.6.0...v1.7.0) (2026-04-01)


### Bug Fixes

* **assessment:** wire assess run Trivy probe and Helm vuln/scan env ([a927b4d](https://github.com/alto9/kube9-operator/commit/a927b4d178b1fdf391a7b164ba5e1e6c480c50ae))
* **deps:** add husky devDependency for prepare script ([#109](https://github.com/alto9/kube9-operator/issues/109)) ([513082b](https://github.com/alto9/kube9-operator/commit/513082ba2c3c40844425423c035fd4f2f6bd361f))
* **helm:** allow workloadImageScan in values schema ([98bf3af](https://github.com/alto9/kube9-operator/commit/98bf3af229456c048a2f90a54ce78bce44fc3733))


### Features

* **database:** add image scan schema and repository for issue 98 ([b1da14b](https://github.com/alto9/kube9-operator/commit/b1da14bb5c04da2114536d3674bd522761e4fc18))
* **security:** vulnerability thresholds, query CLI, and scan metrics ([7f169e7](https://github.com/alto9/kube9-operator/commit/7f169e7544344596a7e96b1a13764e39bd9d81c3)), closes [#99](https://github.com/alto9/kube9-operator/issues/99)
* **trivy:** collect workload images and gate Trivy scans ([2e62f1b](https://github.com/alto9/kube9-operator/commit/2e62f1b551c1ef88e5a6baa47b1f6fb31190b66e)), closes [#97](https://github.com/alto9/kube9-operator/issues/97)
* **trivy:** optional server detection and scanner client ([53756de](https://github.com/alto9/kube9-operator/commit/53756dec9039b0957b23a92a11a785f137ab90a1)), closes [#96](https://github.com/alto9/kube9-operator/issues/96)

# [1.6.0](https://github.com/alto9/kube9-operator/compare/v1.5.0...v1.6.0) (2026-03-26)


### Features

* **assessment:** add namespace resource governance performance check ([641e780](https://github.com/alto9/kube9-operator/commit/641e780dfb0d69981df5139bf0d56a31a364fd2c))
* **assessment:** add performance-efficiency autoscaling checks ([4ffc36e](https://github.com/alto9/kube9-operator/commit/4ffc36e931bff97a8245d7db258b54ea5cbca75f))
* **assessment:** add placement checks for node affinity ([6d62fe8](https://github.com/alto9/kube9-operator/commit/6d62fe81042c81e94adb94d11ba936face2138f6))

# [1.5.0](https://github.com/alto9/kube9-operator/compare/v1.4.0...v1.5.0) (2026-03-25)


### Bug Fixes

* **reliability:** support PDB matchExpressions in workload coverage ([cb9d7bc](https://github.com/alto9/kube9-operator/commit/cb9d7bce2b95cde6881b4031c6832e187fec5b56))


### Features

* **assessment:** add liveness and readiness probe reliability checks ([4fba6a4](https://github.com/alto9/kube9-operator/commit/4fba6a4853fe4abf865513992712eac4aed3bd43)), closes [#82](https://github.com/alto9/kube9-operator/issues/82)
* **assessment:** add reliability checks for resource requests and limits ([4103c8b](https://github.com/alto9/kube9-operator/commit/4103c8b4fb4c0bd85e77570d9842f34022ecd61a)), closes [#81](https://github.com/alto9/kube9-operator/issues/81)
* **assessment:** add reliability HA checks (replicas, spread, PDB) ([2fa7635](https://github.com/alto9/kube9-operator/commit/2fa763547f30a7fb610d54e02fa640c96e4fbb48)), closes [#80](https://github.com/alto9/kube9-operator/issues/80)
* **reliability:** add backup and disaster recovery signals check ([59d9128](https://github.com/alto9/kube9-operator/commit/59d9128a0636d1aacba6da3e17844c5b1fc73b99)), closes [#83](https://github.com/alto9/kube9-operator/issues/83)

# [1.4.0](https://github.com/alto9/kube9-operator/compare/v1.3.0...v1.4.0) (2026-03-19)


### Bug Fixes

* **assessment:** resolve TypeScript errors in security check test mocks ([fa522b8](https://github.com/alto9/kube9-operator/commit/fa522b8151581f82e9b036de3e0818ae2590edc4))
* **tests:** resolve TypeScript and integration test failures ([5b652b0](https://github.com/alto9/kube9-operator/commit/5b652b002565de46227caff1614bd41e61006340))


### Features

* **assessment:** implement security context validation checks ([71d7ac1](https://github.com/alto9/kube9-operator/commit/71d7ac1653bb92fdf4de0cb8d871da4f401e1c4f))
* **security:** implement RBAC policy analysis checks ([62e50ee](https://github.com/alto9/kube9-operator/commit/62e50ee96f883be7b2c2fd2aae8edf704288e5ff)), closes [#74](https://github.com/alto9/kube9-operator/issues/74)
* **security:** implement secret management audit checks ([#75](https://github.com/alto9/kube9-operator/issues/75)) ([082d91e](https://github.com/alto9/kube9-operator/commit/082d91eafa6cecfc15824f89dea00b3904559cc4))

# [1.3.0](https://github.com/alto9/kube9-operator/compare/v1.2.1...v1.3.0) (2026-02-17)


### Features

* **assessment:** add check registry and validation ([c80f971](https://github.com/alto9/kube9-operator/commit/c80f971d068a4dbad599a59b140f772784eca524)), closes [#33](https://github.com/alto9/kube9-operator/issues/33)
* **assessment:** add Prometheus metrics instrumentation ([4e97091](https://github.com/alto9/kube9-operator/commit/4e97091179a7237a265660b1f1c1674c5b699f0b)), closes [#37](https://github.com/alto9/kube9-operator/issues/37)
* **assessment:** create check interfaces and core types (GH-32) ([416c33f](https://github.com/alto9/kube9-operator/commit/416c33fa5f2471bea7908728ec142b22b58264d5)), closes [#32](https://github.com/alto9/kube9-operator/issues/32)
* **assessment:** implement assessment runner orchestration ([#35](https://github.com/alto9/kube9-operator/issues/35)) ([4be40a8](https://github.com/alto9/kube9-operator/commit/4be40a8ee816c623958a3631dfd342ddc793b2c4))
* **cli:** add assessment CLI commands and output formatters ([e82d39a](https://github.com/alto9/kube9-operator/commit/e82d39af38f311a2f75fc1b13fe7f99997d7bd1f)), closes [#36](https://github.com/alto9/kube9-operator/issues/36)
* **db:** implement assessment database schema and migrations (GH-31) ([62542a8](https://github.com/alto9/kube9-operator/commit/62542a85cbc1df6b76d6db97f27d2782d809802f)), closes [#31](https://github.com/alto9/kube9-operator/issues/31) [#14](https://github.com/alto9/kube9-operator/issues/14)

## [1.2.1](https://github.com/alto9/kube9-operator/compare/v1.2.0...v1.2.1) (2026-01-09)


### Bug Fixes

* explicitly set owner parameter in GitHub App token step ([c4b1969](https://github.com/alto9/kube9-operator/commit/c4b196928451924a290a7105ce6ce0bc3389d768))
* remove comment from repositories list in GitHub App token step ([c210293](https://github.com/alto9/kube9-operator/commit/c2102938def53a50a8c567243c640f94c5f7df49))

# [1.2.0](https://github.com/alto9/kube9-operator/compare/v1.1.4...v1.2.0) (2025-12-31)


### Features

* **events:** complete event capturing functionality ([#8](https://github.com/alto9/kube9-operator/issues/8)) ([a8ad239](https://github.com/alto9/kube9-operator/commit/a8ad2392acfb1db177133c25c1947e5078acfdb3))

## [1.1.4](https://github.com/alto9/kube9-operator/compare/v1.1.3...v1.1.4) (2025-12-22)


### Bug Fixes

* **status:** use correct error property 'code' for 404 detection ([3184b91](https://github.com/alto9/kube9-operator/commit/3184b91313ee558ce3fb309b2633a8978b0c1627))

## [1.1.3](https://github.com/alto9/kube9-operator/compare/v1.1.2...v1.1.3) (2025-12-22)


### Bug Fixes

* **status:** improve 404 error detection for ConfigMap creation ([88dbca5](https://github.com/alto9/kube9-operator/commit/88dbca52a58bfd8d23499c2193511b0d9afaf1fc))

## [1.1.2](https://github.com/alto9/kube9-operator/compare/v1.1.1...v1.1.2) (2025-12-22)


### Bug Fixes

* **status:** correct 404 error detection in StatusWriter ConfigMap creation ([20905da](https://github.com/alto9/kube9-operator/commit/20905da56af18438cb6ab3fad79cbb1c67a89832))

## [1.1.1](https://github.com/alto9/kube9-operator/compare/v1.1.0...v1.1.1) (2025-12-22)


### Bug Fixes

* **health:** correct 404 error detection in ConfigMap write test ([350e306](https://github.com/alto9/kube9-operator/commit/350e30668ebe0cbf5ae8826b5d2814ba1f2f69db))

# [1.1.0](https://github.com/alto9/kube9-operator/compare/v1.0.10...v1.1.0) (2025-12-22)


### Features

* extract namespace constant in status calculator ([d77a7a6](https://github.com/alto9/kube9-operator/commit/d77a7a6834fb02fc2e6ab61c4609fd69282bd384))
* **status:** add namespace field to OperatorStatus interface ([57fa401](https://github.com/alto9/kube9-operator/commit/57fa40134973a88623c93ce555eec5f5cdce9c97))
* update resource requests and limits for operator pod ([34b8bce](https://github.com/alto9/kube9-operator/commit/34b8bce9ba652191f95d336983451b7738bd769b))

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

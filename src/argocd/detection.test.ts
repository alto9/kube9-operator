import { test } from 'node:test';
import assert from 'node:assert';
import * as k8s from '@kubernetes/client-node';
import { extractVersion } from './detection.js';

test('extractVersion - extracts version from app.kubernetes.io/version label', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {
        'app.kubernetes.io/version': 'v2.8.0'
      }
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: []
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, 'v2.8.0', 'Should extract version from app.kubernetes.io/version label');
});

test('extractVersion - extracts version from argocd.argoproj.io/version label', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {
        'argocd.argoproj.io/version': '2.7.0'
      }
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: []
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, '2.7.0', 'Should extract version from argocd.argoproj.io/version label');
});

test('extractVersion - extracts version from generic version label', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {
        'version': 'v2.6.0'
      }
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: []
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, 'v2.6.0', 'Should extract version from generic version label');
});

test('extractVersion - label priority: app.kubernetes.io/version takes precedence', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {
        'app.kubernetes.io/version': 'v2.8.0',
        'argocd.argoproj.io/version': 'v2.7.0',
        'version': 'v2.6.0'
      }
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: []
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, 'v2.8.0', 'Should prioritize app.kubernetes.io/version over other labels');
});

test('extractVersion - extracts version from image tag with v prefix', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {}
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: [
            {
              name: 'argocd-server',
              image: 'quay.io/argoproj/argocd:v2.8.0'
            }
          ]
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, 'v2.8.0', 'Should extract version from image tag with v prefix');
});

test('extractVersion - extracts version from image tag without v prefix', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {}
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: [
            {
              name: 'argocd-server',
              image: 'quay.io/argoproj/argocd:2.8.0'
            }
          ]
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, 'v2.8.0', 'Should extract version from image tag without v prefix and add v prefix');
});

test('extractVersion - extracts version from container with argocd in image name', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {}
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: [
            {
              name: 'other-container',
              image: 'nginx:latest'
            },
            {
              name: 'argocd-container',
              image: 'quay.io/argoproj/argocd:v2.7.0'
            }
          ]
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, 'v2.7.0', 'Should extract version from container with argocd in image name');
});

test('extractVersion - returns null when no version labels exist and no image tag match', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {}
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: [
            {
              name: 'argocd-server',
              image: 'quay.io/argoproj/argocd:latest'
            }
          ]
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, null, 'Should return null when no version can be determined');
});

test('extractVersion - returns null when deployment has no containers', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {}
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: []
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, null, 'Should return null when deployment has no containers');
});

test('extractVersion - returns null when deployment metadata is missing', () => {
  const deployment: k8s.V1Deployment = {
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: [
            {
              name: 'argocd-server',
              image: 'quay.io/argoproj/argocd:v2.8.0'
            }
          ]
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  // Should still extract from image tag even without metadata
  assert.strictEqual(version, 'v2.8.0', 'Should extract from image tag even when metadata is missing');
});

test('extractVersion - image tag regex handles various formats', () => {
  const testCases = [
    { image: 'quay.io/argoproj/argocd:v2.8.0', expected: 'v2.8.0' },
    { image: 'quay.io/argoproj/argocd:2.8.0', expected: 'v2.8.0' },
    { image: 'argoproj/argocd:v2.7.5', expected: 'v2.7.5' },
    { image: 'argoproj/argocd:2.7.5', expected: 'v2.7.5' },
    { image: 'registry.example.com/argocd:v1.0.0', expected: 'v1.0.0' }
  ];
  
  for (const testCase of testCases) {
    const deployment: k8s.V1Deployment = {
      metadata: {
        labels: {}
      },
      spec: {
        selector: {
          matchLabels: {}
        },
        template: {
          spec: {
            containers: [
              {
                name: 'argocd-server',
                image: testCase.image
              }
            ]
          }
        }
      }
    };
    
    const version = extractVersion(deployment);
    assert.strictEqual(
      version,
      testCase.expected,
      `Should extract version ${testCase.expected} from image ${testCase.image}`
    );
  }
});

test('extractVersion - returns null when image tag does not match semantic version pattern', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {}
    },
    spec: {
      selector: {
        matchLabels: {}
      },
      template: {
        spec: {
          containers: [
            {
              name: 'argocd-server',
              image: 'quay.io/argoproj/argocd:latest'
            }
          ]
        }
      }
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, null, 'Should return null for non-semantic version tags');
});

test('extractVersion - handles deployment with missing spec', () => {
  const deployment: k8s.V1Deployment = {
    metadata: {
      labels: {}
    }
  };
  
  const version = extractVersion(deployment);
  assert.strictEqual(version, null, 'Should return null when deployment spec is missing');
});


#!/usr/bin/env groovy

// See https://github.com/capralifecycle/jenkins-pipeline-library
@Library('cals') _

buildConfig([
  slack: [
    channel: '#cals-dev-info',
    teamDomain: 'cals-capra',
  ],
]) {
  dockerNode {
    checkout scm

    // There is actually a race condition here as multiple builds might
    // build the same tag.
    def img = docker.build('cals-cli')
    img.inside {
      stage('Install dependencies') {
        sh 'npm ci'
      }

      stage('Lint') {
        sh 'npm run lint'
      }

      stage('Tests') {
        sh 'npm test'
      }

      stage('Build') {
        sh 'npm run build'
      }

      stage('Test CLI') {
        sh 'node lib/cals-cli.js --help'
      }

      if (env.BRANCH_NAME == 'master') {
        stage('Semantic release') {
          withSemanticReleaseEnv {
            sh 'npm run semantic-release'
          }
        }
      }
    }
  }
}

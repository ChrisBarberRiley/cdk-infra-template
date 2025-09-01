# cdk-infra-template

Reusable **AWS CDK v2** template for spinning up backend infra to reuse across projects.
Two context args: `project` and `stage`.

## What this repo gives you (now)
* A **DynamoDB** table named `<project>-<stage>-<dataBase>` (configurable via `-c dataBase`, defaults to `data`).
* A value in **AWS SSM Parameter Store** at `/<project>/<stage>/table_name`.
* Stack env uses your shell’s AWS profile/region.

> Future steps (not yet included): **SNS → SQS** events, **Lambda**, **API Gateway**, **Cognito**, **S3 + CloudFront**. All follow the same `project/stage` pattern.

---

## Prerequisites

* Node.js 20+
* AWS CLI v2 (authenticated with a profile that can deploy)
* CDK CLI v2: `npm i -g aws-cdk@2`
* (Optional) pnpm: `npm i -g pnpm`

## One‑time bootstrap (per account/region)

```bash
export AWS_PROFILE=<YOUR_PROFILE>
export AWS_REGION=eu-west-1   # or your region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION
```

> You can make the two `export` lines persistent - I've added to `~/.zshrc`.

## Day‑to‑day commands

```bash
# Preview the CloudFormation the app would deploy
cdk synth -c project=test -c stage=dev

# Deploy (idempotent)
# Optional: pick your own base name for the table
cdk deploy -c project=test -c stage=dev -c dataBase=dbname

# See what would change vs deployed state
cdk diff -c project=test -c stage=dev

# Tear down (careful!)
cdk destroy --all -c project=test -c stage=dev
```

## Verify the contract value in SSM

```bash
aws ssm get-parameter \
  --name /test/dev/table_name \
  --query Parameter.Value --output text
```

## Conventions

* **Naming:** `name(base, { project, stage }) => `\${project}-\${stage}-\${base}\`.
* **Context args:** pass with `-c project=<name> -c stage=<dev|stg|prod> [-c dataBase=<base>]`.
* **SSM paths:** `/<project>/<stage>/*` (e.g., `/explore/dev/api_url`).
* **Public repo safe:** account/region are read from environment; no account IDs.


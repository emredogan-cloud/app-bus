#!/usr/bin/env bash
# Bootstrap the Terraform remote state backend (S3 bucket + DynamoDB lock).
# Run once per AWS account.
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
BUCKET="${STATE_BUCKET:-app-bus-tfstate}"
TABLE="${LOCK_TABLE:-app-bus-tflock}"

echo "Region: ${REGION}"
echo "State bucket: ${BUCKET}"
echo "Lock table: ${TABLE}"

if ! aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "Creating S3 state bucket…"
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration "LocationConstraint=${REGION}"

  aws s3api put-bucket-versioning \
    --bucket "${BUCKET}" \
    --versioning-configuration "Status=Enabled"

  aws s3api put-bucket-encryption \
    --bucket "${BUCKET}" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

  aws s3api put-public-access-block \
    --bucket "${BUCKET}" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
else
  echo "State bucket already exists."
fi

if ! aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" >/dev/null 2>&1; then
  echo "Creating DynamoDB lock table…"
  aws dynamodb create-table \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}"
else
  echo "Lock table already exists."
fi

echo "Done."

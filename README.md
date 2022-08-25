# vault-creds-to-tfc-workspace

Github Action to Publish Credentials to Terraform Cloud Workspace

## Purpose

To publish HashiCorp Vault credentials to a Terraform Cloud (TFC) or Terraform Enterprise (TFE) workspace for use with remote TFC runs.

This action will take redacted secrets from your workflow and publish then to sensitive redacted
environment variables in the TFC workspace.

Supports Amazon Web Services (AWS) access keys and Google Cloud Platform (GCP) service account keys at this time.

**NOTE:** *This action will never publish input values to debug; this can make debugging difficult,
but we must ensure that no secret leakage occurs when debugging is enabled.*

## Inputs

The action has the following inputs, with the provision that at least one credentials (Google or AWS) must be provided:

* `tfc_host` - The TFC (or TFE) hostname.
  * **Required**: NO
  * **Default**: `app.terraform.io`
* `tfc_token` - The token to use to authenticate with Terraform Cloud.
  * **Required**: NO
  * **Default**: Contents of `TFC_TOKEN` environment variable; else empty string.
* `organization` - The organization in TFC containing the target workspace.
  * **Required**: YES
  * **Default**: Empty string.
* `workspace` - The target workspace to receive the credentials.
  * **Required**: YES
  * **Default**: Empty string.
* `aws_access_key` - AWS Access Key ID from Vault (assumes Vault standard formatting).
  * **Required**: NO
  * **Default**: Empty string.
* `aws_secret_key` - AWS Secret Key ID from Vault (assumes Vault standard formatting).
  * **Required**: NO
  * **Default**: Empty string.
* `gcp_svcacct_key` - GCP service account key from Vault (assumes Vault standard formatting).
  * **Required**: NO
  * **Default**: Empty string.

## Use

Add a step using this action to your workflow after you've retrieved your credentials from Vault, and reference the retrieved credentials:

``` yaml
- name: Setup workspace credentials.
uses: husa-dtg/vault-creds-to-tfc-workspace@v1.0.0
with:
    tfc_host: app.terraform.io # This is the default; optional.
    tfc_token: ${{ steps.STEP_NAME.outputs.TFC_CREDS_NAME }} 
    organization: ORGANIZATION_NAME
    workspace: WORKSPACE_NAME
    aws_access_key: ${{ steps.STEP_NAME.outputs.AWS_ACCESS_KEY_NAME }}
    aws_secret_key: ${{ steps.STEP_NAME.outputs.AWS_SECRET_KEY_NAME }}
    gcp_svcacct_key: ${{ steps.STEP_NAME.outputs.GCP_CREDS_NAME }}
```

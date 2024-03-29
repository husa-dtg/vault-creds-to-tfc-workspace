# vault-creds-to-tfc-workspace

Github Action to Publish Credentials to Terraform Cloud Workspace

## Purpose

To publish HashiCorp Vault credentials to a Terraform Cloud (TFC) or Terraform Enterprise (TFE) workspace for use with remote TFC runs.

This action will take redacted secrets from your workflow and publish then to sensitive redacted
environment variables in the TFC workspace.

Supports the following credentials at this time:

* Amazon Web Services (AWS) access keys
* Google Cloud Platform (GCP) service account keys
* Google Cloud Platform (GCP) Workload Identiy Pool and Service Account Email
* Terraform Cloud tokens for use with TFE provider

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
* `tfe_token` - The token for the TFE provider to use (assumes TFE/TFC standard formatting).
  * **Required**: NO
  * **Default**: Contents of `TFE_TOKEN` environment variable; else empty string.
* `tfc_workload_identity` - The workload identity provider name for the App IAC GCP Projects.
  * **Required**: NO
  * **Default**: Contents of `TFC_GCP_WORKLOAD_PROVIDER_NAME` environment variable; else empty string.
 * `tfc_service_account` - The app iac service account name to authenticate to workload identity provider.
  * **Required**: NO
  * **Default**: Contents of `TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL` environment variable; else empty string.


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
      tfe_token: ${{ steps.STEP_NAME.outputs.TFE_TOKEN_NAME }}
```

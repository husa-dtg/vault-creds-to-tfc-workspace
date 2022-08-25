const axios = require('axios');
const { base64decode, base64encode } = require('nodejs-base64');
const core = require("@actions/core");

// VAULT SECRET REGEX PATTERNS
// 
// AWS
// ACCESS_KEY_ID: (?<![A-Z0-9])[A-Z0-9]{20}(?![A-Z0-9])
// SECRET_KEY_ID: (?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])
// 
// GCP
// PRIVATE_KEY: ^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{3}=|[A-Za-z\d+/]{2}==)?$

// Get input from the workflow step.
const tfc_host = core.getInput('tfc_host');
const tfc_token = core.getInput('tfc_token') || process.env.TFC_TOKEN || process.env.tfc_token;
const organization = core.getInput('organization');
const workspace = core.getInput('workspace');
const aws_access_key = core.getInput('aws_access_key');
const aws_secret_key = core.getInput('aws_secret_key');
const gcp_svcacct_key = core.getInput('gcp_svcacct_key');

// validate_input() - Check our action inputs for existence and valid contents.
async function validate_input() {
    // Check tfc_host.
    if (!tfc_host) {
        core.setFailed("tfc_host not provided");
    }

    // Check tfc_token.
    if (!tfc_token) {
        core.setFailed("tfc_token not provided");
    }

    // Check organization.
    if (!organization) {
        core.setFailed("organization not provided");
    }

    // Check workspace.
    if (!workspace) {
        core.setFailed("workspace not provided");
    }

    // Set a flag to ensure we have at lease one credential provided.
    var flag = false;

    // Check AWS access and secret keys.
    // If an access key is provided...
    if (!!aws_access_key) {
        if (!!aws_secret_key) {
            // ...and a secret key is provided...check for valid formatting on access key...
            if (!aws_access_key.match(/(?<![A-Z0-9])[A-Z0-9]{20}(?![A-Z0-9])/)) {
                core.setFailed("aws_access_key invalid");
            }
            // ...and valid formatting on secret key...
            if (!aws_secret_key.match(/(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/)) {
                core.setFailed("aws_secret_key invalid");
            }
            // Valid formatting; set flag.
            flag = true;
        } else {
            // ...no secret key, fail.
            core.setFailed("aws_access_key provided without an aws_secret_key");
        }
    } else if (!!aws_secret_key) {
        // ...no access key, fail.
        core.setFailed("aws_secret_key provided without an aws_access_key");
    }

    // Check the GCP key.
    // If a key is provided...
    if (!!gcp_svcacct_key) {
        // ...check if valid formatting...
        if (!gcp_svcacct_key.match(/^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{3}=|[A-Za-z\d+/]{2}==)?$/)) {
            // ...invalid formatting, fail.
            core.setFailed("gcp_svcacct_key set but invalid format");
        } else {
            // Valid formatting; set flag.
            flag = true;
        }
    }

    // Do we have at least one credential to set?
    if (!flag) {
        core.setFailed("no valid credential provided to be put into the workspace");
    }
}

// main() - Primary entrypoint for this action.
async function main() {
    // Validate our input; will exit action if anything is wrong.
    await validate_input();

    // Shortcut while we test input.
    return;
    
    try {
        // Define our API HTTP client options.
        const apiOptions = {
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'Authorization': 'Bearer ' + tfc_token
            }
        };
        core.debug("api_options: " + JSON.stringify(apiOptions));

        // Fetch Workspace ID
        const tfcWorkspaceEndpoint = "https://" + tfc_host + "/api/v2/organizations/" + organization + "/workspaces/" + workspace;
        var response = await axios.get(tfcWorkspaceEndpoint, apiOptions);
        const workspaceId = response.data.data.id;
        core.debug("workspaceId: " + workspaceId);

        // Fetch the variable ID
        const tfcListVariablesEndpoint = "https://" + tfc_host + "/api/v2/vars/?filter[organization][name]=" + organization + "&filter[workspace][name]=" + workspace;
        response = await axios.get(tfcListVariablesEndpoint, apiOptions);
        const workspaceVariables = response.data.data;
        let variableId = null;
        for (let variable of workspaceVariables) {
            if (variable.attributes.key === variable_key) {
                variableId = variable.id;
            }
        }
        if (variableId == null) {
            core.setFailed('variable could not be found in workspace');
        }

        const tfcVariableUpdateEndpoint = "https://" + tfc_host + "/api/v2/vars/" + variableId;
        let updateRequest = {
            data: {
                id: variableId,
                attributes: {
                    "value": variable_value,
                    "hcl": 'false',
                },
                type: "vars",
            }
        };
        core.debug("updateRequest:" + JSON.stringify(updateRequest));

        // Invoking Terraform Variable Patch API
        axios.patch(tfcVariableUpdateEndpoint, updateRequest, apiOptions)
            .then((response) => {
                core.info("update variable success:" + JSON.stringify(response.data));
                // TODO - Do we need to do this?
                // core.setOutput("variableId", response.data.data.id);
            }, (error) => {
                core.setFailed("update variable error:" + JSON.stringify(error.response.data));
                core.setFailed(error.message);
            });
    } catch (error) {
        //  Report the error back to the runner.
        core.setFailed(error.message);
    }
}

// Run the action.
main();

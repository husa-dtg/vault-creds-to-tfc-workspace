const axios = require('axios');
const { base64decode } = require('nodejs-base64');
const core = require("@actions/core");

// main() - Primary entrypoint for this action.
async function main() {
    try {
        // Get input from the workflow.
        const organization = core.getInput('organization');
        const workspace = core.getInput('workspace');
        const tfc_token = core.getInput('tfc_token');
        const tfc_host = core.getInput('tfc_host');
        const variable_key = core.getInput('variable_key');
        const variable_value_temp = core.getInput('variable_value');
        const variable_value = base64decode(variable_value_temp).replace(/\r?\n|\r/g,"");

        // TODO - Validate the input.

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
const core = require("@actions/core");
const axios = require('axios').default;
const { base64decode, base64encode } = require('nodejs-base64');

// Get input from the workflow step.
const tfc_host = core.getInput('tfc_host');
const tfc_token = core.getInput('tfc_token') || process.env.TFC_TOKEN || process.env.tfc_token;
const organization = core.getInput('organization');
const workspace = core.getInput('workspace');
const aws_access_key = core.getInput('aws_access_key');
const aws_secret_key = core.getInput('aws_secret_key');
const gcp_svcacct_key = core.getInput('gcp_svcacct_key');

const httpOptions = {
    headers: {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
        Authorization: "Bearer " + tfc_token,
    }
}

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

// getWorkspaceId() - Get the workspace ID based on provided workspace name.
async function getWorkspaceId() {
    // Fetch Workspace ID
    const tfcWorkspaceEndpoint = "https://" + tfc_host + "/api/v2/organizations/" + organization + "/workspaces/" + workspace;
    const response = await axios.get(tfcWorkspaceEndpoint, httpOptions);
    if (response.status != 200) {
        core.debug("getWorkspaceId(): response.status: " + response.status);
        core.debug("getWorkspaceId(): response.headers: " + JSON.stringify(response.headers));
        core.debug("getWorkspaceId(): response.data: " + JSON.stringify(response.data));
        core.setFailed("tfc api call for workspace id failed");
    }

    // Return the Workspace ID.
    core.debug("getWorkspaceId(): return: " + response.data.data.id);
    return response.data.data.id;
}

// getWorkspaceVariables() - Get the variable details for the workspace.
async function getWorkspaceVariables() {
    // Fetch the variables in the workspace.
    const tfcListVariablesEndpoint = "https://" + tfc_host + "/api/v2/vars/?filter[organization][name]=" + organization + "&filter[workspace][name]=" + workspace;
    const response = await axios.get(tfcListVariablesEndpoint, httpOptions);
    if (response.status != 200) {
        core.debug("getWorkspaceVariables(): response.status: " + response.status);
        core.debug("getWorkspaceVariables(): response.headers: " + JSON.stringify(response.headers));
        core.debug("getWorkspaceVariables(): response.data: " + JSON.stringify(response.data));
        core.setFailed("tfc api call for workspace variable details failed");
    }

    // Set null as default.
    let variableIds = [];

    // Iterate through variables grabbings names and IDs.
    for (let variable of response.data.data) {
        variableIds.push({ 'name': variable.attributes.key, 'id': variable.id });
    }

    // Return the Variable ID or null.
    core.debug("getWorkspaceVariables(): return: " + JSON.stringify(variableIds));
    return variableIds;
}

// getVariableId() - Return the variable ID or null for the requested variable name.
async function getVariableId(workspaceVariables, variableName) {
    for (let variable of workspaceVariables) {
        if (variable.name === variableName) {
            core.debug("getVariableId(): return: " + JSON.stringify(variable.id));
            return variable.id;
        }
    }
    core.debug("getVariableId(): return: null");
    return null;
}

// updateWorkspaceVariable() - Update the workspace variable provided with contents provided.
async function updateWorkspaceVariable(varId, contents) {
    // Update the existing variable.
    const tfcVariableUpdateEndpoint = "https://" + tfc_host + "/api/v2/vars/" + varId;
    const updateRequest = {
        data: {
            id: varId,
            attributes: {
                "category": "env",
                "value": contents,
                "hcl": false,
                "sensitive": true,
            },
            type: "vars",
        },
    };
    // Invoking Terraform Variable Patch API
    const response = await axios.patch(tfcVariableUpdateEndpoint, updateRequest, httpOptions);
    if (response.status != 200) {
        core.debug("updateWorkspaceVariable(): response.status: " + response.status);
        core.debug("updateWorkspaceVariable(): response.headers: " + JSON.stringify(response.headers));
        core.debug("updateWorkspaceVariable(): response.data: " + JSON.stringify(response.data));
        core.setFailed("tfc api call to update workspace variable failed");
    }

    core.debug("updateWorkspaceVariable(): response.statusText: " + response.statusText);
}

// createWorkspaceVariable() - Create the workspace variable name provided with contents provided.
async function createWorkspaceVariable(workspaceId, varName, contents) {
    // Update the existing variable.
    const tfcVariableUpdateEndpoint = "https://" + tfc_host + "/api/v2/vars";
    const updateRequest = {
        data: {
            type: "vars",
            attributes: {
                category: "env",
                key: varName,
                value: contents,
                hcl: false,
                sensitive: true,
            },
            relationships: {
                workspace: {
                    data: {
                        type: "workspaces",
                        id: workspaceId,
                    },
                },
            },
        },
    };
    // Invoking Terraform Variable Patch API
    const response = await axios.post(tfcVariableUpdateEndpoint, updateRequest, httpOptions);
    if (response.status != 200) {
        core.debug("updateWorkspaceVariable(): response.status: " + response.status);
        core.debug("updateWorkspaceVariable(): response.headers: " + JSON.stringify(response.headers));
        core.debug("updateWorkspaceVariable(): response.data: " + JSON.stringify(response.data));
        core.setFailed("tfc api call to update workspace variable failed");
    }

    core.debug("updateWorkspaceVariable(): variable created: " + response.data.id);
}

// main() - Primary entrypoint for this action.
async function main() {
    // Validate our input; will fail action if anything is wrong.
    await validate_input();

    // Get the workspace ID from the TFC API.
    var workspaceId = await getWorkspaceId();
    core.debug("main(): workspaceId: " + workspaceId);

    // Get the details for the variables in the workspace.
    var workspaceVariables = await getWorkspaceVariables();
    core.debug("main(): workspaceVariables: "+ JSON.stringify(workspaceVariables));

    // Set the AWS credential, if present.
    // if (!!aws_access_key && !!aws_secret_key) {

    // }

    // Set the GCP credential, if present.
    if (!!gcp_svcacct_key) {
        const gcpVarName = "GOOGLE_CREDENTIALS";
        // Grab the variable ID for the GCP creds variable.
        const gcpVarId = await getVariableId(workspaceVariables, gcpVarName);
        // Process accordingly depending on variable existence.
        if (!!gcpVarId) {
            // Variable exists; update it.
            await updateWorkspaceVariable(gcpVarId, gcp_svcacct_key);
        } else {
            // Variable doesn't exist; create it.
            await createWorkspaceVariable(workspaceId, gcpVarName, gcp_svcacct_key);
        }
    }
}

// Run the action.
main();

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
const tfe_token = core.getInput('tfe_token');
const tfc_service_account = core.getInput('tfc_service_account');
const tfc_workload_identity = core.getInput('tfc_workload_identity');

// Create global for workspace ID.
var workspaceId = "";

// Global header definitions for axios requests.
const httpOptions = {
    headers: {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${tfc_token}`,
    }
}

// validate_input() - Check our action inputs for existence and valid contents.
async function validate_input() {
    core.debug("validate_input(): begin");

    // Check tfc_host.
    if (!tfc_host) {
        const err_message = "invalid input: tfc_host not provided";
        core.setFailed(err_message);
        throw new Error(err_message);
    }

    // Check tfc_token.
    if (!tfc_token) {
        const err_message = "invalid input: tfc_token not provided";
        core.setFailed(err_message);
        throw new Error(err_message);
    }

    // Check organization.
    if (!organization) {
        const err_message = "invalid input: organization not provided";
        core.setFailed(err_message);
        throw new Error(err_message);
    }

    // Check workspace.
    if (!workspace) {
        const err_message = "invalid input: workspace not provided";
        core.setFailed(err_message);
        throw new Error(err_message);
    }

    // Set a flag to ensure we have at lease one credential provided.
    var flag = false;

    // Check AWS access and secret keys.
    // If an access key is provided...
    if (!!aws_access_key) {
        if (!!aws_secret_key) {
            // ...and a secret key is provided...check for valid formatting on access key...
            if (!aws_access_key.match(/(?<![A-Z0-9])[A-Z0-9]{20}(?![A-Z0-9])/)) {
                const err_message = "invalid input: aws_access_key invalid format";
                core.setFailed(err_message);
                throw new Error(err_message);
            }
            // ...and valid formatting on secret key...
            if (!aws_secret_key.match(/(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/)) {
                const err_message = "invalid input: aws_secret_key invalid format";
                core.setFailed(err_message);
                throw new Error(err_message);
            }
            // Valid formatting; set flag.
            flag = true;
        } else {
            // ...no secret key, fail.
            const err_message = "invalid input: aws_access_key provided without an aws_secret_key";
            core.setFailed(err_message);
            throw new Error(err_message);
        }
    } else if (!!aws_secret_key) {
        // ...no access key, fail.
        const err_message = "invalid input: aws_secret_key provided without an aws_access_key";
        core.setFailed(err_message);
        throw new Error(err_message);
    }

    // Check the GCP key.
    // If a key is provided...
    if (!!gcp_svcacct_key) {
        // ...check if valid formatting...
        if (!gcp_svcacct_key.match(/^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{3}=|[A-Za-z\d+/]{2}==)?$/)) {
            // ...invalid formatting, fail.
            const err_message = "invalid input: gcp_svcacct_key invalid format";
            core.setFailed(err_message);
            throw new Error(err_message);
        } else {
            // Valid formatting; set flag.
            flag = true;
        }
    }

    // Check the TFE token.
    // If a token is provided...
    if (!!tfe_token) {
        // ...check if valid formatting...
        if (!tfe_token.match(/^[A-Za-z0-9]+\.atlasv[1]\.[A-Za-z0-9]+$/)) {
            // ...invalid formatting, fail.
            const err_message = "invalid input: tfe_token invalid format";
            core.setFailed(err_message);
            throw new Error(err_message);
        } else {
            // Valid formatting; set flag.
            flag = true;
        }
    }
    // Do we have at least one credential to set?
    if (!flag) {
        const err_message = "invalid input: no valid credential provided to put into the workspace";
        core.setFailed(err_message);
        throw new Error(err_message);
    }
    core.debug("validate_input(): return");
}

// getWorkspaceId() - Get the workspace ID based on provided workspace name.
async function getWorkspaceId() {
    core.debug("getWorkspaceId(): begin");

    // Fetch Workspace ID
    const tfcWorkspaceEndpoint = `https://${tfc_host}/api/v2/organizations/${organization}/workspaces/${workspace}`;
    try {
        const response = await axios.get(tfcWorkspaceEndpoint, httpOptions);
        if (response.status != 200) {
            core.debug(`getWorkspaceId(): response.status: ${response.status}`);
            core.debug(`getWorkspaceId(): response.headers: ${JSON.stringify(response.headers)}`);
            core.debug(`getWorkspaceId(): response.data: ${JSON.stringify(response.data)}`);
            const err_message = "tfc api call for workspace id failed";
            core.setFailed(err_message);
            throw new Error(err_message);
        }

        // Return the Workspace ID.
        core.debug(`getWorkspaceId(): return: ${response.data.data.id}`);
        return response.data.data.id;
    } catch (e) {
        core.debug(`getWorkspaceId(): method: ${e.request.method}, path: ${e.request.path}, response: ${e.response.status} - ${e.response.statusText}`);
        const err_message = "uncaught exception during tfc api call for workspace id";
        core.setFailed(err_message);
        throw new Error(err_message);
    }
}

// getWorkspaceVariables() - Get the variable details for the workspace.
async function getWorkspaceVariables() {
    core.debug("getWorkspaceVariables(): begin");

    // Fetch the variables in the workspace.
    const tfcListVariablesEndpoint = `https://${tfc_host}/api/v2/workspaces/${workspaceId}/vars`;
    try {
        const response = await axios.get(tfcListVariablesEndpoint, httpOptions);
        if (response.status != 200) {
            core.debug(`getWorkspaceVariables(): response.status: ${response.status}`);
            core.debug(`getWorkspaceVariables(): response.headers: ${JSON.stringify(response.headers)}`);
            core.debug(`getWorkspaceVariables(): response.data: ${JSON.stringify(response.data)}`);
            const err_message = "tfc api call for workspace variable details failed";
            core.setFailed(err_message);
            throw new Error(err_message);
        }

        // Set null as default.
        var variableIds = [];

        // Iterate through variables grabbings names and IDs.
        for (let variable of response.data.data) {
            variableIds.push({ 'name': variable.attributes.key, 'id': variable.id });
        }

        // Return the Variable ID or null.
        core.debug(`getWorkspaceVariables(): return: ${JSON.stringify(variableIds)}`);
        return variableIds;
    } catch (e) {
        core.debug(`method: ${e.request.method}, path: ${e.request.path}, response: ${e.response.status} - ${e.response.statusText}`);
        const err_message = "uncaught exception during tfc api call for workspace variable details";
        core.setFailed(err_message);
        throw new Error(err_message);
    }
}

// getVariableId() - Return the variable ID or null for the requested variable name.
async function getVariableId(workspaceVariables, variableName) {
    core.debug("getVariableId(): begin");

    for (let variable of workspaceVariables) {
        if (variable.name === variableName) {
            core.debug(`getVariableId(): return: ${JSON.stringify(variable.id)}`);
            return variable.id;
        }
    }
    core.debug("getVariableId(): return: null");
    return null;
}

// updateWorkspaceVariable() - Update the workspace variable provided with contents provided.
async function updateWorkspaceVariable(varId, contents) {
    core.debug("updateWorkspaceVariable(): begin");

    // Update the existing variable.
    const tfcVariableUpdateEndpoint = `https://${tfc_host}/api/v2/workspaces/${workspaceId}/vars/${varId}`;
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
    try {
        const response = await axios.patch(tfcVariableUpdateEndpoint, updateRequest, httpOptions);
        if (response.status != 200) {
            core.debug(`updateWorkspaceVariable(): response.status: ${response.status}`);
            core.debug(`updateWorkspaceVariable(): response.headers: ${JSON.stringify(response.headers)}`);
            core.debug(`updateWorkspaceVariable(): response.data: ${JSON.stringify(response.data)}`);
            const err_message = "tfc api call to update workspace variable failed (updateWorkspaceVariable)";
            core.setFailed(err_message);
            throw new Error(err_message);
        }
        core.debug(`updateWorkspaceVariable(): response.statusText: ${response.statusText}`);
        core.debug("updateWorkspaceVariable(): return");
        return;
    } catch (e) {
        core.debug(`method: ${e.request.method}, path: ${e.request.path}, response: ${e.response.status} - ${e.response.statusText}`);
        const err_message = "uncaught exception during tfc api call to update workspace variable failed (updateWorkspaceVariable)";
        core.setFailed(err_message);
        throw new Error(err_message);
    }
}

// createWorkspaceVariable() - Create the workspace variable name provided with contents provided.
async function createWorkspaceVariable(workspaceId, varName, contents) {
    core.debug("createWorkspaceVariable(): begin");

    // Update the existing variable.
    const tfcVariableUpdateEndpoint = `https://${tfc_host}/api/v2/workspaces/${workspaceId}/vars`;
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
    try {
        const response = await axios.post(tfcVariableUpdateEndpoint, updateRequest, httpOptions);
        if (response.status != 201) {
            core.debug(`createWorkspaceVariable(): response.status: ${response.status}`);
            core.debug(`createWorkspaceVariable(): response.headers: ${JSON.stringify(response.headers)}`);
            core.debug(`createWorkspaceVariable(): response.data: ${JSON.stringify(response.data)}`);
            const err_message = "tfc api call to create workspace variable failed (createWorkspaceVariable)";
            core.setFailed(err_message);
            throw new Error(err_message);
        }
        core.debug(`createWorkspaceVariable(): variable created: ${response.data.data.id}`);
        core.debug("createWorkspaceVariable(): return");
        return;
    } catch (e) {
        core.debug(`method: ${e.request.method}, path: ${e.request.path}, response: ${e.response.status} - ${e.response.statusText}`);
        const err_message = "uncaught exception during tfc api call to create workspace variable failed (createWorkspaceVariable)";
        core.setFailed(err_message);
        throw new Error(err_message);
    }
}

// main() - Primary entrypoint for this action.
async function main() {
    core.debug("main(): begin");

    // Validate our input; will fail action if anything is wrong.
    await validate_input();
    core.debug("main: input validated");

    // Get the workspace ID from the TFC API.
    workspaceId = await getWorkspaceId();
    core.debug(`main(): workspaceId: ${workspaceId}`);

    // Get the details for the variables in the workspace.
    var workspaceVariables = await getWorkspaceVariables();
    core.debug(`main(): workspaceVariables: ${JSON.stringify(workspaceVariables)}`);

    // Set the AWS credential, if present.
    if (!!aws_access_key && !!aws_secret_key) {
        core.debug("main(): setting aws workspace variables");

        const awsAccessVarName = "AWS_ACCESS_KEY_ID";

        // Grab the variable ID for the GCP credentials variable.
        const awsAccessVarId = await getVariableId(workspaceVariables, awsAccessVarName);
        core.debug(`main(): awsAccessVarId: ${awsAccessVarId}`);

        // Process accordingly depending on variable existence.
        if (!!awsAccessVarId) {
            // Variable exists; update it.
            core.debug("main(): aws access key workspace variable exists: updating");
            await updateWorkspaceVariable(awsAccessVarId, aws_access_key);
        } else {
            // Variable doesn't exist; create it.
            core.debug("main(): aws access key workspace variable does not exist: creating");
            await createWorkspaceVariable(workspaceId, awsAccessVarName, aws_access_key);
        }

        const awsSecretVarName = "AWS_SECRET_ACCESS_KEY";

        // Grab the variable ID for the GCP credentials variable.
        const awsSecretVarId = await getVariableId(workspaceVariables, awsSecretVarName);
        core.debug(`main(): awsSecretVarId: ${awsSecretVarId}`);

        // Process accordingly depending on variable existence.
        if (!!awsSecretVarId) {
            // Variable exists; update it.
            core.debug("main(): aws secret key workspace variable exists: updating");
            await updateWorkspaceVariable(awsSecretVarId, aws_secret_key);
        } else {
            // Variable doesn't exist; create it.
            core.debug("main(): aws secret key workspace variable does not exist: creating");
            await createWorkspaceVariable(workspaceId, awsSecretVarName, aws_secret_key);
        }
    }

    // Set the GCP credential, if present.
    if (!!gcp_svcacct_key) {
        core.debug("main(): setting gcp workspace variable");

        const gcpVarName = "GOOGLE_CREDENTIALS";

        // Grab the variable ID for the GCP creds variable.
        const gcpVarId = await getVariableId(workspaceVariables, gcpVarName);
        core.debug(`main(): gcpVarId: ${gcpVarId}`);

        // Process accordingly depending on variable existence.
        if (!!gcpVarId) {
            // Variable exists; update it.
            core.debug("main(): gcp workspace variable exists: updating");
            await updateWorkspaceVariable(gcpVarId, base64decode(gcp_svcacct_key).replace(/\r?\n|\r/g, ""));
        } else {
            // Variable doesn't exist; create it.
            core.debug("main(): gcp workspace variable does not exist: creating");
            await createWorkspaceVariable(workspaceId, gcpVarName, base64decode(gcp_svcacct_key).replace(/\r?\n|\r/g, ""));
        }
    }

    // Set the TFE token, if present.
    if (!!tfe_token) {
        core.debug("main(): setting tfe workspace variable");

        const tfeVarName = "TFE_TOKEN";

        // Grab the variable ID for the TFE token variable.
        const tfeVarId = await getVariableId(workspaceVariables, tfeVarName);
        core.debug(`main(): tfeVarId: ${tfeVarId}`);

        // Process accordingly depending on variable existence.
        if (!!tfeVarId) {
            // Variable exists; update it.
            core.debug("main(): tfe workspace variable exists: updating");
            await updateWorkspaceVariable(tfeVarId, tfe_token);
        } else {
            // Variable doesn't exist; create it.
            core.debug("main(): tfe workspace variable does not exist: creating");
            await createWorkspaceVariable(workspaceId, tfeVarName, tfe_token);
        }
    }

    // Set the tfc_service_account, if present.
    if (!!tfc_service_account) {
        core.debug("main(): setting tfe workspace variable");

        const tfeVarName = "TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL";

        // Grab the variable ID for the TFE token variable.
        const tfeVarId = await getVariableId(workspaceVariables, tfeVarName);
        core.debug(`main(): tfeVarId: ${tfeVarId}`);

        // Process accordingly depending on variable existence.
        if (!!tfeVarId) {
            // Variable exists; update it.
            core.debug("main(): tfe workspace variable exists: updating");
            await updateWorkspaceVariable(tfeVarId, tfc_service_account);
        } else {
            // Variable doesn't exist; create it.
            core.debug("main(): tfe workspace variable does not exist: creating");
            await createWorkspaceVariable(workspaceId, tfeVarName, tfc_service_account);
        }
    }

    // Set the tfc_workload_identity, if present.
    if (!!tfc_workload_identity) {
        core.debug("main(): setting tfe workspace variable");

        const tfeVarName = "TFC_GCP_WORKLOAD_PROVIDER_NAME";

        // Grab the variable ID for the TFE token variable.
        const tfeVarId = await getVariableId(workspaceVariables, tfeVarName);
        core.debug(`main(): tfeVarId: ${tfeVarId}`);

        // Process accordingly depending on variable existence.
        if (!!tfeVarId) {
            // Variable exists; update it.
            core.debug("main(): tfe workspace variable exists: updating");
            await updateWorkspaceVariable(tfeVarId, tfc_workload_identity);
        } else {
            // Variable doesn't exist; create it.
            core.debug("main(): tfe workspace variable does not exist: creating");
            await createWorkspaceVariable(workspaceId, tfeVarName, tfc_workload_identity);
        }
    }

    core.debug("main(): return");
}

// Run the action.
try {
    main();
} catch (e) {
    core.error(`error: ${e}`);
}

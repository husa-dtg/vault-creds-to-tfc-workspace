require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 806:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 771:
/***/ ((module) => {

module.exports = eval("require")("axios");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const core = __nccwpck_require__(806);
const axios = __nccwpck_require__(771);

// main() - Primary entrypoint for this action.
async function main() {
    try {
        // Get input from the workflow.
        const organization = core.getInput('organization');
        const workspace = core.getInput('workspace');
        const tfc_token = core.getInput('tfc_token');
        const tfc_host = core.getInput('tfc_host');
        const variable_key = core.getInput('variable_key');
        const variable_value = core.getInput('variable_value');

        // TODO - Validate the input.

        // Define our API HTTP client options.
        const apiOptions = {
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'Authorization': 'Bearer' + tfc_token
            }
        };
        core.debug("api_options: " + apiOptions);

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
})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map
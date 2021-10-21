import * as msal from "@azure/msal-browser";
import { welcomeUser, updateTable } from "./app";
import { msalConfig, loginRequest } from "./authConfig";
import { init } from "./client";

// Create the main myMSALObj instance
// configuration parameters are located at authConfig.js
export const myMSALObj = new msal.PublicClientApplication(msalConfig);

export let username = "";

export function selectAccount() {
  /**
   * See here for more info on account retrieval:
   * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/Accounts.md
   */

  const currentAccounts = myMSALObj.getAllAccounts();

  if (!currentAccounts || currentAccounts.length < 1) {
    return;
  } else if (currentAccounts.length > 1) {
    // Add your account choosing logic here
    console.warn("Multiple accounts detected.");
  } else if (currentAccounts.length === 1) {
    username = currentAccounts[0].username;
    welcomeUser(username);
    updateTable();
  }
}

export function handleResponse(response) {
  /**
   * To see the full list of response object properties, visit:
   * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/request-response-object.md#response
   */

  if (response !== null) {
    username = response.account.username;
    welcomeUser(username);
    updateTable();
  } else {
    selectAccount();

    /**
     * If you already have a session that exists with the authentication server, you can use the ssoSilent() API
     * to make request for tokens without interaction, by providing a "login_hint" property. To try this, comment the
     * line above and uncomment the section below.
     */

    // myMSALObj.ssoSilent(silentRequest).
    //     then(() => {
    //         const currentAccounts = myMSALObj.getAllAccounts();
    //         username = currentAccounts[0].username;
    //         welcomeUser(username);
    //         updateTable();
    //     }).catch(error => {
    //         console.error("Silent Error: " + error);
    //         if (error instanceof msal.InteractionRequiredAuthError) {
    //             signIn();
    //         }
    //     });
  }
}

export function signIn() {
  /**
   * You can pass a custom request object below. This will override the initial configuration. For more information, visit:
   * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/request-response-object.md#request
   */
  console.log("singIn called");
  myMSALObj
    .loginPopup(loginRequest)
    .then(handleResponse)
    .catch(error => {
      console.error(error);
    });
}

export function signOut() {
  /**
   * You can pass a custom request object below. This will override the initial configuration. For more information, visit:
   * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/request-response-object.md#request
   */

  // Choose which account to logout from by passing a username.
  const logoutRequest = {
    account: myMSALObj.getAccountByUsername(username),
  };

  myMSALObj.logout(logoutRequest);
}

document.body.onload = () => {
  selectAccount();
  init();
};
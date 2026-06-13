/// <reference types="google-apps-script" />

// GAS server functions — these run on Google's servers, not in the browser.
// Call them from the React app using callServer('functionName', ...args).

// Replace this with your real data fetching logic.
function getData(): { message: string } {
  return { message: 'Hello from Google Apps Script! The app is working.' };
}

// Entry point: serves the React app when users open the web app URL.
// Do not rename this function.
function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('App')
    .setTitle('My App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./chains/polygonAmoy.js":
/*!*******************************!*\
  !*** ./chains/polygonAmoy.js ***!
  \*******************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   polygonAmoy: () => (/* binding */ polygonAmoy)\n/* harmony export */ });\n/* harmony import */ var viem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! viem */ \"viem\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([viem__WEBPACK_IMPORTED_MODULE_0__]);\nviem__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n// frontend/chains/polygonAmoy.js\n\nconst polygonAmoy = (0,viem__WEBPACK_IMPORTED_MODULE_0__.defineChain)({\n    id: 80002,\n    name: \"Polygon Amoy\",\n    network: \"polygon-amoy\",\n    nativeCurrency: {\n        name: \"MATIC\",\n        symbol: \"MATIC\",\n        decimals: 18\n    },\n    rpcUrls: {\n        default: {\n            http: [\n                \"https://rpc-amoy.polygon.technology\"\n            ]\n        }\n    },\n    blockExplorers: {\n        default: {\n            name: \"PolygonScan\",\n            url: \"https://amoy.polygonscan.com\"\n        }\n    }\n});\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jaGFpbnMvcG9seWdvbkFtb3kuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxpQ0FBaUM7QUFDQztBQUUzQixNQUFNQyxjQUFjRCxpREFBV0EsQ0FBQztJQUNyQ0UsSUFBSTtJQUNKQyxNQUFNO0lBQ05DLFNBQVM7SUFDVEMsZ0JBQWdCO1FBQ2RGLE1BQU07UUFDTkcsUUFBUTtRQUNSQyxVQUFVO0lBQ1o7SUFDQUMsU0FBUztRQUNQQyxTQUFTO1lBQ1BDLE1BQU07Z0JBQUM7YUFBc0M7UUFDL0M7SUFDRjtJQUNBQyxnQkFBZ0I7UUFDZEYsU0FBUztZQUNQTixNQUFNO1lBQ05TLEtBQUs7UUFDUDtJQUNGO0FBQ0YsR0FBRSIsInNvdXJjZXMiOlsid2VicGFjazovL3RlYS1mcm9udGVuZC8uL2NoYWlucy9wb2x5Z29uQW1veS5qcz8zM2U5Il0sInNvdXJjZXNDb250ZW50IjpbIi8vIGZyb250ZW5kL2NoYWlucy9wb2x5Z29uQW1veS5qc1xuaW1wb3J0IHsgZGVmaW5lQ2hhaW4gfSBmcm9tICd2aWVtJ1xuXG5leHBvcnQgY29uc3QgcG9seWdvbkFtb3kgPSBkZWZpbmVDaGFpbih7XG4gIGlkOiA4MDAwMixcbiAgbmFtZTogJ1BvbHlnb24gQW1veScsXG4gIG5ldHdvcms6ICdwb2x5Z29uLWFtb3knLFxuICBuYXRpdmVDdXJyZW5jeToge1xuICAgIG5hbWU6ICdNQVRJQycsXG4gICAgc3ltYm9sOiAnTUFUSUMnLFxuICAgIGRlY2ltYWxzOiAxOCxcbiAgfSxcbiAgcnBjVXJsczoge1xuICAgIGRlZmF1bHQ6IHtcbiAgICAgIGh0dHA6IFsnaHR0cHM6Ly9ycGMtYW1veS5wb2x5Z29uLnRlY2hub2xvZ3knXSxcbiAgICB9LFxuICB9LFxuICBibG9ja0V4cGxvcmVyczoge1xuICAgIGRlZmF1bHQ6IHtcbiAgICAgIG5hbWU6ICdQb2x5Z29uU2NhbicsXG4gICAgICB1cmw6ICdodHRwczovL2Ftb3kucG9seWdvbnNjYW4uY29tJyxcbiAgICB9LFxuICB9LFxufSlcblxuIl0sIm5hbWVzIjpbImRlZmluZUNoYWluIiwicG9seWdvbkFtb3kiLCJpZCIsIm5hbWUiLCJuZXR3b3JrIiwibmF0aXZlQ3VycmVuY3kiLCJzeW1ib2wiLCJkZWNpbWFscyIsInJwY1VybHMiLCJkZWZhdWx0IiwiaHR0cCIsImJsb2NrRXhwbG9yZXJzIiwidXJsIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./chains/polygonAmoy.js\n");

/***/ }),

/***/ "./pages/_app.js":
/*!***********************!*\
  !*** ./pages/_app.js ***!
  \***********************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ App)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../styles/globals.css */ \"./styles/globals.css\");\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_styles_globals_css__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var wagmi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! wagmi */ \"wagmi\");\n/* harmony import */ var _chains_polygonAmoy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../chains/polygonAmoy */ \"./chains/polygonAmoy.js\");\n/* harmony import */ var _rainbow_me_rainbowkit__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @rainbow-me/rainbowkit */ \"@rainbow-me/rainbowkit\");\n/* harmony import */ var _rainbow_me_rainbowkit_styles_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @rainbow-me/rainbowkit/styles.css */ \"./node_modules/@rainbow-me/rainbowkit/dist/index.css\");\n/* harmony import */ var _rainbow_me_rainbowkit_styles_css__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_rainbow_me_rainbowkit_styles_css__WEBPACK_IMPORTED_MODULE_5__);\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([wagmi__WEBPACK_IMPORTED_MODULE_2__, _chains_polygonAmoy__WEBPACK_IMPORTED_MODULE_3__, _rainbow_me_rainbowkit__WEBPACK_IMPORTED_MODULE_4__]);\n([wagmi__WEBPACK_IMPORTED_MODULE_2__, _chains_polygonAmoy__WEBPACK_IMPORTED_MODULE_3__, _rainbow_me_rainbowkit__WEBPACK_IMPORTED_MODULE_4__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);\n// frontend/pages/_app.js\n\n\n\n\n\n\n\n// 1. Define chains\nconst chains = [\n    _chains_polygonAmoy__WEBPACK_IMPORTED_MODULE_3__.polygonAmoy\n];\n// 2. Get wallet connectors\nconst { connectors } = (0,_rainbow_me_rainbowkit__WEBPACK_IMPORTED_MODULE_4__.getDefaultWallets)({\n    appName: \"TEA Project\",\n    projectId: \"your_project_id_here\",\n    chains\n});\n// 3. Set up wagmi config with `http()` from viem\nconst config = (0,wagmi__WEBPACK_IMPORTED_MODULE_2__.createConfig)({\n    autoConnect: true,\n    connectors,\n    publicClient: (0,wagmi__WEBPACK_IMPORTED_MODULE_2__.http)()\n});\nfunction App({ Component, pageProps }) {\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(wagmi__WEBPACK_IMPORTED_MODULE_2__.WagmiConfig, {\n        config: config,\n        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_rainbow_me_rainbowkit__WEBPACK_IMPORTED_MODULE_4__.RainbowKitProvider, {\n            chains: chains,\n            children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                ...pageProps\n            }, void 0, false, {\n                fileName: \"/home/morten/tea-project/frontend/pages/_app.js\",\n                lineNumber: 33,\n                columnNumber: 9\n            }, this)\n        }, void 0, false, {\n            fileName: \"/home/morten/tea-project/frontend/pages/_app.js\",\n            lineNumber: 32,\n            columnNumber: 7\n        }, this)\n    }, void 0, false, {\n        fileName: \"/home/morten/tea-project/frontend/pages/_app.js\",\n        lineNumber: 31,\n        columnNumber: 5\n    }, this);\n}\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9wYWdlcy9fYXBwLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5QkFBeUI7O0FBQ0s7QUFDbUI7QUFDckI7QUFDdUI7QUFDMkI7QUFDcEM7QUFFMUMsbUJBQW1CO0FBQ25CLE1BQU1NLFNBQVM7SUFBQ0gsNERBQVdBO0NBQUM7QUFLNUIsMkJBQTJCO0FBQzNCLE1BQU0sRUFBRUksVUFBVSxFQUFFLEdBQUdILHlFQUFpQkEsQ0FBQztJQUN2Q0ksU0FBUztJQUNUQyxXQUFXO0lBQ1hIO0FBQ0Y7QUFFQSxpREFBaUQ7QUFDakQsTUFBTUksU0FBU1QsbURBQVlBLENBQUM7SUFDMUJVLGFBQWE7SUFDYko7SUFDQUssY0FBY1YsMkNBQUlBO0FBQ3BCO0FBRWUsU0FBU1csSUFBSSxFQUFFQyxTQUFTLEVBQUVDLFNBQVMsRUFBRTtJQUNsRCxxQkFDRSw4REFBQ2YsOENBQVdBO1FBQUNVLFFBQVFBO2tCQUNuQiw0RUFBQ0wsc0VBQWtCQTtZQUFDQyxRQUFRQTtzQkFDMUIsNEVBQUNRO2dCQUFXLEdBQUdDLFNBQVM7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJaEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly90ZWEtZnJvbnRlbmQvLi9wYWdlcy9fYXBwLmpzP2UwYWQiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gZnJvbnRlbmQvcGFnZXMvX2FwcC5qc1xuaW1wb3J0ICcuLi9zdHlsZXMvZ2xvYmFscy5jc3MnXG5pbXBvcnQgeyBXYWdtaUNvbmZpZywgY3JlYXRlQ29uZmlnIH0gZnJvbSAnd2FnbWknXG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnd2FnbWknXG5pbXBvcnQgeyBwb2x5Z29uQW1veSB9IGZyb20gJy4uL2NoYWlucy9wb2x5Z29uQW1veSdcbmltcG9ydCB7IGdldERlZmF1bHRXYWxsZXRzLCBSYWluYm93S2l0UHJvdmlkZXIgfSBmcm9tICdAcmFpbmJvdy1tZS9yYWluYm93a2l0J1xuaW1wb3J0ICdAcmFpbmJvdy1tZS9yYWluYm93a2l0L3N0eWxlcy5jc3MnXG5cbi8vIDEuIERlZmluZSBjaGFpbnNcbmNvbnN0IGNoYWlucyA9IFtwb2x5Z29uQW1veV1cblxuXG5cblxuLy8gMi4gR2V0IHdhbGxldCBjb25uZWN0b3JzXG5jb25zdCB7IGNvbm5lY3RvcnMgfSA9IGdldERlZmF1bHRXYWxsZXRzKHtcbiAgYXBwTmFtZTogJ1RFQSBQcm9qZWN0JyxcbiAgcHJvamVjdElkOiAneW91cl9wcm9qZWN0X2lkX2hlcmUnLCAgLy8g8J+RiCByZXBsYWNlIHdpdGggcmVhbCBwcm9qZWN0SWRcbiAgY2hhaW5zLFxufSlcblxuLy8gMy4gU2V0IHVwIHdhZ21pIGNvbmZpZyB3aXRoIGBodHRwKClgIGZyb20gdmllbVxuY29uc3QgY29uZmlnID0gY3JlYXRlQ29uZmlnKHtcbiAgYXV0b0Nvbm5lY3Q6IHRydWUsXG4gIGNvbm5lY3RvcnMsXG4gIHB1YmxpY0NsaWVudDogaHR0cCgpLCAgLy8gdXNlIHZpZW0gY2xpZW50XG59KVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBBcHAoeyBDb21wb25lbnQsIHBhZ2VQcm9wcyB9KSB7XG4gIHJldHVybiAoXG4gICAgPFdhZ21pQ29uZmlnIGNvbmZpZz17Y29uZmlnfT5cbiAgICAgIDxSYWluYm93S2l0UHJvdmlkZXIgY2hhaW5zPXtjaGFpbnN9PlxuICAgICAgICA8Q29tcG9uZW50IHsuLi5wYWdlUHJvcHN9IC8+XG4gICAgICA8L1JhaW5ib3dLaXRQcm92aWRlcj5cbiAgICA8L1dhZ21pQ29uZmlnPlxuICApXG59XG5cbiJdLCJuYW1lcyI6WyJXYWdtaUNvbmZpZyIsImNyZWF0ZUNvbmZpZyIsImh0dHAiLCJwb2x5Z29uQW1veSIsImdldERlZmF1bHRXYWxsZXRzIiwiUmFpbmJvd0tpdFByb3ZpZGVyIiwiY2hhaW5zIiwiY29ubmVjdG9ycyIsImFwcE5hbWUiLCJwcm9qZWN0SWQiLCJjb25maWciLCJhdXRvQ29ubmVjdCIsInB1YmxpY0NsaWVudCIsIkFwcCIsIkNvbXBvbmVudCIsInBhZ2VQcm9wcyJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./pages/_app.js\n");

/***/ }),

/***/ "./styles/globals.css":
/*!****************************!*\
  !*** ./styles/globals.css ***!
  \****************************/
/***/ (() => {



/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "@rainbow-me/rainbowkit":
/*!*****************************************!*\
  !*** external "@rainbow-me/rainbowkit" ***!
  \*****************************************/
/***/ ((module) => {

"use strict";
module.exports = import("@rainbow-me/rainbowkit");;

/***/ }),

/***/ "viem":
/*!***********************!*\
  !*** external "viem" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = import("viem");;

/***/ }),

/***/ "wagmi":
/*!************************!*\
  !*** external "wagmi" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = import("wagmi");;

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/@rainbow-me"], () => (__webpack_exec__("./pages/_app.js")));
module.exports = __webpack_exports__;

})();
import { styleReset } from "react95"
import original from "react95/dist/themes/original"
import { createGlobalStyle } from "styled-components"

export const react95Theme = original

export const React95GlobalStyles = createGlobalStyle`
  ${styleReset}

  body, button, input, select, textarea {
    font-family: "MS Sans Serif", "Tahoma", sans-serif;
  }

  .win95-panel {
    background: #c0c0c0;
    border: 2px solid;
    border-color: #ffffff #808080 #808080 #ffffff;
    box-shadow: 1px 1px 0 #000000;
  }

  .win95-panel-dark {
    background: #b3b3b3;
    border: 2px solid;
    border-color: #f2f2f2 #6f6f6f #6f6f6f #f2f2f2;
    box-shadow: 1px 1px 0 #000000;
  }

  .win95-button {
    position: relative;
    overflow: hidden;
    background: #c0c0c0;
    border: 2px solid;
    border-color: #ffffff #808080 #808080 #ffffff;
    box-shadow: 1px 1px 0 #000000;
    color: #111111;
  }

  .win95-button:hover {
    background: #d4d0c8;
  }

  .win95-button:active {
    border-color: #808080 #ffffff #ffffff #808080;
    box-shadow: inset 1px 1px 0 #000000;
    transform: translate(1px, 1px);
  }

  .win95-button:disabled {
    color: #808080;
    text-shadow: 1px 1px #ffffff;
    background: #c0c0c0;
  }

  .win95-button-blue {
    position: relative;
    overflow: hidden;
    background: #c0c0c0;
    border: 2px solid;
    border-color: #080084;
    box-shadow: 1px 1px 0 #000000;
    color: #111111;
  }

  .win95-button-blue:hover {
    background: #d4d0c8;
  }

  .win95-button-blue:active {
    border-color: #080084;
    box-shadow: inset 1px 1px 0 #000000;
    transform: translate(1px, 1px);
  }

  .win95-button-blue:disabled {
    color: #808080;
    text-shadow: 1px 1px #ffffff;
    background: #c0c0c0;
    border-color: #080084;
  }

  .win95-input {
    background: #ffffff;
    border: 2px solid;
    border-color: #808080 #ffffff #ffffff #808080;
  }

  .win95-inset {
    background: #c0c0c0;
    border: 2px solid;
    border-color: #808080 #ffffff #ffffff #808080;
  }
`

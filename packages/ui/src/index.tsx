// import { InMemoryLogServer, operations, babelPlugin } from "@fromjs/core";
// importing @fromjs/core only works in a node environment because it loads babel
// so import files directly here
import InMemoryLogServer from "../../core/src/InMemoryLogServer";
import operations from "../../core/src/operations";
import babelPlugin from "../../core/src/babelPlugin";
import * as React from "react";
import * as ReactDom from "react-dom";
import OperationLog from "../../core/src/helperFunctions/OperationLog";
const traverse = x => null;
import { escape } from "lodash";
// import Babel from "@babel/standalone";
// document.write("hi");

import * as Baobab from "baobab";
import { branch, root } from "baobab-react/higher-order";

let backendRoot = "http://localhost:" + window["backendPort"];

var appState = new Baobab({
  debugMode: false,
  steps: [],
  inspectionTarget: null
});
window["appState"] = appState;

appState.select("inspectionTarget").on("update", ({ target }) => {
  const inspectionTarget = target.get();
  if (!inspectionTarget || inspectionTarget.logId === null) {
    console.log("no inspection target!!");
  } else {
    showSteps(inspectionTarget.logId, inspectionTarget.charIndex);
  }
});

const DEBUG = true;
const USE_SERVER = true;

class ServerInterface2 {
  loadLog(logId, fn) {
    document.title = logId;
    fetch(backendRoot + "/loadLog", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: logId })
    })
      .then(res => res.json())
      .then(r => {
        fn(r);
      });
  }
}

var exampleSocket = new WebSocket("ws://127.0.0.1:" + window["backendPort"]);

exampleSocket.onmessage = function(event) {
  console.log("websocket onmessage", event.data);
  const message = JSON.parse(event.data);
  if (message.type === "inspectOperationLog") {
    appState.set("inspectionTarget", {
      logId: message.operationLogId,
      charIndex: 0
    });
  }
};

if (DEBUG) {
  document
    .querySelector("#compiled-code")
    .setAttribute("style", "display: block");
}

let serverInterface;
serverInterface = new InMemoryLogServer();
if (USE_SERVER) {
  serverInterface = new ServerInterface2();
} else {
  serverInterface = new InMemoryLogServer();
}

if (!USE_SERVER) {
  window["__storeLog"] = serverInterface.storeLog.bind(serverInterface);
}

var editor = window["CodeMirror"].fromTextArea(
  document.getElementById("code"),
  {
    mode: "javascript",
    lineNumbers: true
  }
);
editor.on("change", function(cMirror) {
  // get value right from instance
  codeTextarea.value = cMirror.getValue();
  try {
    chart.setAttribute("style", "opacity: 0.3");
    update();
    chart.setAttribute("style", "opacity: 1");
  } catch (err) {
    console.log(err);
  }
});

fetch(backendRoot + "/inspect", {
  method: "GET",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json"
  }
})
  .then(res => res.json())
  .then(r => {
    const { logToInspect } = r;
    appState.set("inspectionTarget", {
      logId: logToInspect,
      charIndex: 0
    });
  });

// let previousDomToInspect = null;
// setInterval(function() {
//   fetch(backendRoot + "/inspectDOM", {
//     method: "GET",
//     headers: {
//       Accept: "application/json",
//       "Content-Type": "application/json"
//     }
//   })
//     .then(res => res.json())
//     .then(r => {
//       const { domToInspect } = r;
//       if (domToInspect !== previousDomToInspect) {
//         previousDomToInspect = domToInspect;
//         inspectDom(domToInspect);
//       }
//     });
// }, 5000);

let inspectDom;
class DomInspector extends React.Component<null, any> {
  constructor(props) {
    super(props);
    this.state = {
      domInfo: null
    };
    inspectDom = domInfo => {
      console.log("INSPECT DOM", domInfo);
      this.setState({
        domInfo
      });
    };
  }

  inspect(charIndex) {
    alert("todo");
  }

  render() {
    if (Math.random() > 0.0000000001) {
      return null;
    }

    if (!this.state.domInfo) {
      return null;
    }
    return (
      <div>
        inspect dom
        <pre>
          {JSON.stringify(this.state.domInfo, null, 4)}
          {this.state.domInfo.outerHTML}
          <button onClick={() => this.inspect(5)}>inspect char 5</button>
        </pre>
      </div>
    );
  }
}

const codeTextarea = document.querySelector("#code") as HTMLInputElement;

const compiledCodeTextarea = document.querySelector(
  "#compiled-code"
) as HTMLInputElement;

const chart = document.querySelector(".chart") as HTMLElement;

// update();

function callApi(endpoint, data) {
  return fetch(backendRoot + "/" + endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

function instrumentCode(code) {
  return callApi("instrument", { code });
}

function update() {
  var code = editor.getValue();

  instrumentCode(code)
    .then(({ instrumentedCode }) => {
      let codePromise;

      if (DEBUG) {
        codePromise = callApi("prettify", { code: instrumentedCode }).then(
          r => {
            compiledCodeTextarea.value = r.code.split(
              "/* HELPER_FUNCTIONS_END */ "
            )[1];
            return Promise.resolve(r.code);
          }
        );
      } else {
        codePromise = Promise.resolve(instrumentedCode);
      }
      return codePromise;
    })
    .then(code => runCodeAndshowResult(code));
}

// TODO: don't copy/paste this
function eachArgument(args, arrayArguments, fn) {
  Object.keys(args).forEach(key => {
    if (arrayArguments.includes(key)) {
      args[key].forEach((a, i) => {
        fn(a, "element" + i, newValue => (args[key][i] = newValue));
      });
    } else {
      fn(args[key], key, newValue => (args[key] = newValue));
    }
  });
}

function loadSteps({ logId, charIndex }) {
  if (USE_SERVER) {
    return fetch(backendRoot + "/traverse", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ logId: logId, charIndex })
    }).then(res => res.json());
  } else {
    return new Promise(resolve => {
      loadLog(logId, log => {
        var steps = traverse({ operationLog: log, charIndex });
        resolve({ steps });
      });
    });
  }
}

window["showSteps"] = showSteps;
function showSteps(logId, charIndex) {
  window["updateChar"](charIndex);
  loadSteps({ logId, charIndex }).then(r => {
    var steps = r.steps;
    console.log({ steps });

    appState.set("steps", steps);

    function highlightInTree() {
      document.querySelectorAll("[data-index]").forEach(el => {
        if (el && el.parentElement) {
          el.parentElement.classList.remove("highlight-step");
        }
      });
      steps.forEach(step => {
        var el = document.querySelector(
          "[data-index='" + step.operationLog.index + "']"
        );
        if (el && el.parentElement) {
          el.parentElement.classList.add("highlight-step");
        }
      });
    }
    highlightInTree();

    var html = ``;

    if (Math.random() > 0.000000001) {
      return;
    }

    steps.forEach((step, i) => {
      console.log(step, step.operationLog.stack);

      fetch(backendRoot + "/resolveStackFrame", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          stackFrameString: step.operationLog.stackFrames[0],
          operationLog: step.operationLog
        })
      })
        .then(res => res.json())
        .then(r => {
          console.log("done resolve stack frame", r);
          document.querySelector("#step-code-" + i).innerHTML =
            r.code.line.text;
        });

      var tv = step.operationLog;
      var args = "";
      // eachArgument(tv.args, ["elements"], (arg, argName) => {
      //   args +=
      //     argName +
      //     ": <code>" +
      //     (arg &&
      //       arg.result.str.replace(/</g, "&lt;").replace(/>/g, "&gt;")) +
      //     "</code>";
      // });
      html += `<div>
            ${tv.operation} (char: ${step.charIndex})
            ${tv.result.str.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            <code id="step-code-${i}"></code>
          </div>`;
    });

    document.querySelector("#steps").innerHTML = html;
  });
}

function runCodeAndshowResult(code) {
  try {
    eval(code);
  } catch (err) {
    console.error(err);
    chart.setAttribute("style", "opacity: 0.3");
    return;
  }

  var inspectedValue = window["inspectedValue"];
  showNormalValue(inspectedValue);

  document.querySelector("#basic-example").innerHTML = "";

  showTree(inspectedValue.tracking);
  appState.set("inspectionTarget", {
    logId: inspectedValue.tracking,
    charIndex: 0
  });
}

function loadLog(logIndex, fn) {
  serverInterface.loadLog(logIndex, log => {
    fn(log.args.value);
  });
}

function showNormalValue(inspectedValue) {
  var html =
    "<b>Inspected value:</b><br><div style='margin-top: 5px' id='chars'>";
  var value = inspectedValue.normal;
  for (var i = 0; i < value.length; i++) {
    html += `<span onMouseEnter="showSteps(${inspectedValue.tracking}, ${i})">${
      value[i]
    }</span>`;
  }
  html += "</div>";
  html +=
    "<div style='font-size: 12px; color: #555;margin-top: 10px'>(Hover over each character to see where it originated. Traversing the tree through built-in function calls is tricky, right now only String.prototype.slice is supported.)</div>";
  document.querySelector("#normal-value").innerHTML = html;
}
window["updateChar"] = function(charIndex) {
  try {
    var charEls = document.querySelector("#chars").children;

    Array.from(charEls).forEach(el => el.setAttribute("style", ""));

    charEls[charIndex].setAttribute("style", "color:  #f627c9;");
  } catch (err) {
    console.log(err);
  }
};

function showTree(logIndex) {
  if (window["inspectedValue"].normal === undefined) {
    throw Error("value is undefiend");
  }

  loadLog(logIndex, log => {
    renderTree(log, "#basic-example");
  });
}

function renderTree(log, containerSelector) {
  console.log("rendertree", log);
  var data = log;

  var nodeStructure;

  function isDataRootOrigin(data) {
    if (!data) {
      return false;
    }
    if (["stringLiteral", "numericLiteral"].includes(data.type)) {
      return true;
    }

    return false;
  }

  function truncate(str, maxLength) {
    if (!str || !str.slice) {
      return str;
    }
    if (str.length <= maxLength) {
      return str;
    }
    return str.slice(0, maxLength - 1) + "...";
  }

  function makeNode(data, argName = "", siblingCount = null) {
    if (
      data &&
      data.operation === "identifier"
      // data.operation === "assignmentExpression") // todo: don't ignore assignmentexpr, contains info like += operator
    ) {
      // skip it because it's not very interesting
      console.log("skipping", data);
      return makeNode(data.args.value, argName);
    }

    if (data && data.operation === "functionArgument") {
      return makeNode(data.args.value);
    }

    var childValues;
    const operationLogIsNotLoaded = typeof data === "number";
    if (data && operationLogIsNotLoaded) {
      return {
        innerHTML: `<div style="font-size: 11px; color: #999; font-weight: normal;">
        (Not loaded in FE, inspect parent to see details.)
      </div>`,

        HTMLclass: "node--not-loaded",
        children: []
      };
    }
    if (data && !operationLogIsNotLoaded) {
      var operation = operations[data.operation];
      childValues = operation.getArgumentsArray(data);
      if (data.operation === "assignmentExpression") {
        childValues = childValues.filter(c => c.argName !== "newValue");
        // currentvalue would matter if operation isn't "=" but e.g. "+="...
        childValues = childValues.filter(c => c.argName !== "currentValue");
      }
    } else {
      childValues = [];
    }
    childValues = childValues.filter(c => !!c.arg);
    var children = [];
    if (!isDataRootOrigin(data)) {
      children = childValues.map((child, i) =>
        makeNode(child.arg, child.argName, childValues.length - 1)
      );
    }

    var type;
    if (data) {
      type = data.operation;
      if (type === "binaryExpression") {
        type =
          "<span style='color: green;font-weight: bold;'>" +
          data.astArgs.operator +
          "</span>" +
          " " +
          type;
      }
    } else {
      type = "(" + data + ")";
    }

    var resVal;
    if (data) {
      resVal = data.result;
    } else {
      // debugger;
      resVal = {
        type: "string",
        str: "todo (no data)"
      };
    }

    var valueClass = "value--other";
    var str = truncate(resVal.str, 40 * 10000);
    if (resVal.type === "string") {
      valueClass = "value--string";
      str = `"${str}"`;
    } else if (resVal.type == "number") {
      valueClass = "value--number";
    }

    const treeCodeDivId =
      "tree-code-div-" + Math.floor(Math.random() * 1000000000000000);

    var node = {
      innerHTML: `<div>
        <div
          style="font-weight: normal; overflow: hidden;text-align: left; border-bottom: 1px solid #ddd;padding-bottom: 2px;margin-bottom: 2px;">
          ${argName}
          <span style="font-weight: normal; font-size: 11px; color: #999;">(${type})</span>
          <button style="cursor: pointer; float: right;    border: none;
          text-decoration: underline;" onclick="showSteps(${
            data.index
          }, 0)">Inspect</button>
        </div>
        <div class="operation" data-index="${data.index}">
          <div class="code-container">
            <code style="font-size: 11px" id="${treeCodeDivId}">&nbsp;</code>
          </div>
          <div>
            <span class="value ${valueClass}">${escape(str)}</span>
          </div>  
        </div>
        
      </div>`,

      children
    };

    if (data && !operationLogIsNotLoaded) {
      resolveStackFrame(data)
        .then(stackFrame => {
          document.querySelector("#" + treeCodeDivId).innerHTML =
            stackFrame.code.line.text;
        })
        .catch(() => {
          document.querySelector("#" + treeCodeDivId).innerHTML = "(error)";
        });
    }

    return node;
  }
  nodeStructure = makeNode(data);

  var chart_config = {
    chart: {
      container: containerSelector,

      connectors: {
        type: "step"
      },
      node: {
        HTMLclass: "nodeExample1"
      },
      levelSeparation: 20
    },
    nodeStructure: nodeStructure
  };

  window["yyyyy"] = new window["Treant"](chart_config);
}

window["showResult"] = update;

function resolveStackFrame(operationLog) {
  return fetch(backendRoot + "/resolveStackFrame", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      stackFrameString: operationLog.stackFrames[0],
      operationLog: operationLog
    })
  }).then(res => {
    if (res.status === 500) {
      throw "resolve stack error";
    } else {
      return res.json();
    }
  });
}

function getFileNameFromPath(path) {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function onInspectionTargetChanged() {
  console.log("onInspectionTargetChanged", arguments);
}

type TraversalStepProps = {
  step: any;
  debugMode?: boolean;
};
type TraversalStepState = {
  stackFrame: any;
  showLogJson: boolean;
  showTree: boolean;
  isExpanded: boolean;
};

let TraversalStep = class TraversalStep extends React.Component<
  TraversalStepProps,
  TraversalStepState
> {
  constructor(props) {
    super(props);
    this.state = {
      stackFrame: null,
      showLogJson: false,
      showTree: false,
      isExpanded: false
    };

    const { step } = props;
    resolveStackFrame(step.operationLog)
      .then(r => {
        // console.log("got stackframe", r);
        this.setState({
          stackFrame: r
        });
        // console.log("done resolve stack frame", r);
        // document.querySelector("#step-code-" + i).innerHTML =
        //   r.code.line.text;
      })
      .catch(err => "yolo");
  }
  render() {
    const { step, debugMode } = this.props;
    const { charIndex, operationLog } = step;
    const { showTree, showLogJson, stackFrame, isExpanded } = this.state;
    let code;
    let fileName, columnNumber, lineNumber;
    let previousLine, nextLine;

    try {
      const { previousLines, nextLines } = stackFrame.code;
      code = stackFrame.code.line.text;
      fileName = stackFrame.fileName.replace("?dontprocess", "");
      lineNumber = stackFrame.lineNumber;
      columnNumber = stackFrame.columnNumber;
      if (previousLines.length > 0) {
        previousLine = previousLines[previousLines.length - 1].text;
      }
      if (nextLines.length > 0) {
        nextLine = nextLines[nextLines.length - 1].text;
      }
    } catch (err) {
      code = "Loading or error...";
      fileName = "(error)";
    }

    function prepareText(text) {
      if (text.length < 50) {
        return text;
      }
      return text.slice(0, 15) + "..." + text.slice(-30);
    }

    const str = operationLog.result.str;
    // const beforeChar = prepareText(str.slice(0, charIndex));
    // const char = str.slice(charIndex, charIndex + 1);
    // const afterChar = prepareText(str.slice(charIndex + 1));

    let operationTypeDetail = null;
    if (operationLog.operation === "identifier" && stackFrame && code) {
      operationTypeDetail =
        "(" +
        code.slice(operationLog.loc.start.column, operationLog.loc.end.column) +
        ")";
    }

    return (
      <div style={{ padding: 5 }} className="step">
        <div className="step__header">
          <div className="step__operation-type">
            {operationLog.operation} {operationTypeDetail}
          </div>
          <span style={{ fontSize: "12px", marginTop: 3, float: "right" }}>
            {getFileNameFromPath(fileName)}
          </span>
          <button
            style={{ float: "right" }}
            onClick={() => this.setState({ isExpanded: !isExpanded })}
          >
            {isExpanded ? "-" : "+"}
          </button>
        </div>
        <div className="step__body">
          {debugMode && fileName + ":" + lineNumber + ":" + columnNumber}
          {debugMode && (
            <button
              onClick={() => this.setState({ showLogJson: !showLogJson })}
            >
              toggle show log json
            </button>
          )}
          {showLogJson && <pre>{JSON.stringify(operationLog, null, 4)}</pre>}

          <div className="code-container">
            {isExpanded && (
              <code style={{ display: "block" }}>{previousLine}</code>
            )}
            <code>{code}</code>
            {isExpanded && <code style={{ display: "block" }}>{nextLine}</code>}
          </div>
          {/* <div className="step__string">
            <span>{beforeChar}</span>
            <span style={{ color: "#dc1045" }}>{char}</span>
            <span>{afterChar}</span>
          </div> */}
          <div>
            <TextEl
              text={str}
              highlightedCharacterIndex={charIndex}
              onCharacterClick={charIndex =>
                appState.set(["inspectionTarget", "charIndex"], charIndex)
              }
            />
          </div>
          <div>
            {isExpanded && (
              <button
                style={{ float: "right" }}
                onClick={() => this.setState({ showTree: !showTree })}
              >
                Show Tree
              </button>
            )}
          </div>
          {showTree && <OperationLogTreeView operationLog={operationLog} />}
        </div>
      </div>
    );
  }
};

TraversalStep = branch(
  {
    debugMode: ["debugMode"]
  },
  TraversalStep
);

type OperationLogTreeViewProps = {
  operationLog: any;
};

class OperationLogTreeView extends React.Component<
  OperationLogTreeViewProps,
  {}
> {
  id = Math.floor(Math.random() * 100000000000);

  render() {
    return (
      <div
        className="chart"
        style={{ width: "100%", height: 500, border: "1px solid #ddd" }}
        id={this.getContainerId()}
      >
        xxxxxx
      </div>
    );
  }
  getContainerId() {
    return "operation-log-tree-view-" + this.id;
  }
  componentDidMount() {
    renderTree(this.props.operationLog, "#" + this.getContainerId());
  }
}

type TraversalStepsProps = {
  steps?: any[];
};
let TraversalSteps = class TraversalSteps extends React.Component<
  TraversalStepsProps,
  {}
> {
  render() {
    let stepsToShow = [];
    let steps = this.props.steps;
    if (!steps.length) {
      return null;
    }

    stepsToShow = steps;

    const interestingSteps = [];
    let previousStep = steps[0];
    // debugger;
    for (var i = 1; i < steps.length - 1; i++) {
      const step = steps[i];
      const previousStepCriteria = getStepInterestingnessCriteria(previousStep);
      const stepCriteria = getStepInterestingnessCriteria(step);

      console.log(step);
      if (step.operationLog.operation === "jsonParseResult") {
        // debugger;
      }
      if (
        previousStepCriteria.charsAfter !== stepCriteria.charsAfter ||
        previousStepCriteria.charsBefore !== stepCriteria.charsBefore
      ) {
        interestingSteps.push(step);
      }
      previousStep = step;
    }

    function getStepInterestingnessCriteria(step) {
      let str = step.operationLog.result.str;

      let charIndexTwoCharsBefore = step.charIndex - 2;
      if (charIndexTwoCharsBefore < 0) {
        charIndexTwoCharsBefore = 0;
      }
      let charIndexTwoCharsAfter = step.charIndex + 2;
      if (charIndexTwoCharsAfter > str.length - 1) {
        charIndexTwoCharsAfter = str.length - 1;
      }
      return {
        charsBefore: str.slice(charIndexTwoCharsBefore, step.charIndex),
        charsAfter: str.slice(step.charIndex, charIndexTwoCharsAfter)
      };
    }

    // if (this.props.debugMode) {

    // } else {

    //   stepsToShow.push(steps[0])
    //   console.log("this logic is very awful!! won't work for many operations without loc, also doesn't consider filename just line nnumber")
    //   for (var i = 1; i < steps.length; i++) {
    //     const thisStep = steps[i]
    //     let previousStepToShow = stepsToShow[stepsToShow.length - 1]
    //     if (!previousStepToShow.operationLog.loc) {
    //       stepsToShow.push(thisStep)
    //       continue
    //     }
    //     let previousStepLine = previousStepToShow.operationLog.loc.start.line
    //     let previousStepStr = previousStepToShow.operationLog.result.str

    //     let thisStepStr = thisStep.operationLog.result.str
    //     if (!thisStep.operationLog.loc) {
    //       stepsToShow.push(thisStep)
    //       continue
    //     }
    //     let thisStepLine = thisStep.operationLog.loc.start.line

    //     if (previousStepLine !== thisStepLine || previousStepStr !== thisStepStr) {
    //       stepsToShow.push(thisStep)
    //     }
    //   }
    // }

    return (
      <div>
        <div>Inspected step:</div>
        <TraversalStep key={steps[0].operationLog.index} step={steps[0]} />
        <div>First step where selected character was introduced:</div>
        <TraversalStep
          key={steps[steps.length - 1].operationLog.index}
          step={steps[steps.length - 1]}
        />
        <hr />
        <hr />
        <div>Relevant code:</div>
        {interestingSteps
          .map(step => (
            <TraversalStep key={step.operationLog.index} step={step} />
          ))
          .reverse()}
        <hr />
        <hr />
        <div>Full data flow:</div>
        {stepsToShow
          .map(step => (
            <TraversalStep key={step.operationLog.index} step={step} />
          ))
          .reverse()}
      </div>
    );
  }
};

TraversalSteps = branch(
  {
    debugMode: ["debugMode"],
    steps: ["steps"]
  },
  TraversalSteps
);

class TextEl extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      truncateText: true
    };
  }
  shouldComponentUpdate(nextProps, nextState) {
    // console.time("TextEl shouldUpdate")
    var shouldUpdate =
      JSON.stringify(nextProps) !== JSON.stringify(this.props) ||
      JSON.stringify(nextState) !== JSON.stringify(this.state);
    // console.timeEnd("TextEl shouldUpdate")
    return shouldUpdate;
  }
  render() {
    var self = this;

    function splitLines(str) {
      var lineStrings = str.split("\n");
      var lines = [];
      var charOffset = 0;
      lineStrings.forEach(function(lineString, i) {
        var isLastLine = i + 1 === lineStrings.length;
        var text = lineString + (isLastLine ? "" : "\n");
        var charOffsetStart = charOffset;
        var charOffsetEnd = charOffset + text.length;
        lines.push({
          text: text,
          lineNumber: i,
          charOffsetStart: charOffsetStart,
          charOffsetEnd: charOffsetEnd,
          containsCharIndex: function(index) {
            return index >= charOffsetStart && index < charOffsetEnd;
          },
          splitAtCharIndex: function(index) {
            var lineBeforeIndex = text.substr(
              0,
              highlightedCharIndex - charOffsetStart
            );
            var lineAtIndex = text.substr(
              highlightedCharIndex - charOffsetStart,
              1
            );
            var lineAfterIndex = text.substr(
              highlightedCharIndex + 1 - charOffsetStart
            );
            return [
              {
                text: lineBeforeIndex,
                charOffsetStart: charOffsetStart
              },
              {
                text: lineAtIndex,
                charOffsetStart: charOffsetStart + lineBeforeIndex.length
              },
              {
                text: lineAfterIndex,
                charOffsetStart:
                  charOffsetStart + lineBeforeIndex.length + lineAtIndex.length
              }
            ];
          }
        });
        charOffset = charOffsetEnd;
      });

      if (charOffset !== str.length) {
        throw "looks like sth went wrong?";
      }
      return lines;
    }

    function processChar(char) {
      if (char === "\n") {
        char = "\u21B5"; // downwards arrow with corner leftwards
      }
      if (char === " ") {
        char = "\xa0";
      }
      if (char === "\t") {
        char = "\xa0\xa0";
      }
      return char;
    }
    function charIsWhitespace(char) {
      return char === "\t" || char === " ";
    }
    function getValueSpan(
      char,
      extraClasses,
      key,
      onClick,
      onMouseEnter,
      onMouseLeave
    ) {
      var className = extraClasses;
      if (charIsWhitespace(char)) {
        className += " fromjs-value__whitespace-character";
      }

      var processedChar = processChar(char);

      return (
        <span
          className={className}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          key={key}
        >
          {processedChar}
        </span>
      );
    }
    function getValueSpans(val, indexOffset) {
      var els = [];
      for (let index = 0; index < val.length; index++) {
        var char = val[index];

        els.push(
          getValueSpan(
            char,
            "",
            index + indexOffset,
            () => {
              self.props.onCharacterClick(index + indexOffset);
            },
            () => {
              if (!self.props.onCharacterHover) {
                return;
              }
              self.props.onCharacterHover(index + indexOffset);
            },
            () => {
              if (!self.props.onCharacterHover) {
                return;
              }
              self.props.onCharacterHover(null);
            }
          )
        );
      }
      return els;
    }

    var val = this.props.text;

    var self = this;
    var highlightedCharIndex = this.props.highlightedCharacterIndex;

    if (highlightedCharIndex === undefined || highlightedCharIndex === null) {
      return <div className="fromjs-value">{getValueSpans(val, 0)}</div>;
    } else {
      var lines = splitLines(val);

      var valBeforeColumn = val.substr(0, highlightedCharIndex);
      var valAtColumn = val.substr(highlightedCharIndex, 1);
      var valAfterColumn = val.substr(highlightedCharIndex + 1);

      var highlightedCharLineIndex = valBeforeColumn.split("\n").length;

      var showFromLineIndex = highlightedCharLineIndex - 2;
      if (showFromLineIndex < 0) {
        showFromLineIndex = 0;
      }
      var showToLineIndex = showFromLineIndex + 3;

      if (!this.state.truncateText) {
        showFromLineIndex = 0;
        showToLineIndex = lines.length;
      }

      var linesToShow = lines.slice(showFromLineIndex, showToLineIndex);

      function getLineComponent(line, beforeSpan, afterSpan) {
        var valueSpans = [];
        if (line.containsCharIndex(highlightedCharIndex)) {
          var chunks = line.splitAtCharIndex(highlightedCharIndex);

          var textBeforeHighlight = chunks[0].text;
          if (textBeforeHighlight.length > 50 && self.state.truncateText) {
            var textA = textBeforeHighlight.slice(0, 40);
            var textB = textBeforeHighlight.slice(
              textBeforeHighlight.length - 10
            );
            valueSpans = [
              getValueSpans(textA, chunks[0].charOffsetStart),
              getEllipsisSpan("ellipsis-line-before-highlight"),
              getValueSpans(
                textB,
                chunks[0].charOffsetStart +
                  textBeforeHighlight.length -
                  textB.length
              )
            ];
          } else {
            valueSpans = valueSpans.concat(
              getValueSpans(chunks[0].text, chunks[0].charOffsetStart)
            );
          }

          valueSpans = valueSpans.concat(
            getValueSpan(
              chunks[1].text,
              "fromjs-highlighted-character",
              "highlighted-char-key",
              function() {},
              function() {},
              function() {}
            )
          );

          var restofLineValueSpans;
          var textAfterHighlight = chunks[2].text;
          if (textAfterHighlight.length > 60 && self.state.truncateText) {
            restofLineValueSpans = [
              getValueSpans(
                chunks[2].text.slice(0, 60),
                chunks[2].charOffsetStart
              ),
              getEllipsisSpan("ellipsis-line-after-highlight")
            ];
          } else {
            restofLineValueSpans = getValueSpans(
              chunks[2].text,
              chunks[2].charOffsetStart
            );
          }
          valueSpans = valueSpans.concat(restofLineValueSpans);
        } else {
          valueSpans = getValueSpans(line.text, line.charOffsetStart);
        }
        return (
          <div key={"Line" + line.lineNumber}>
            {beforeSpan}
            {valueSpans}
            {afterSpan}
          </div>
        );
      }

      function getEllipsisSpan(key) {
        return (
          <span onClick={() => self.disableTruncateText()} key={key}>
            ...
          </span>
        );
      }

      var ret = (
        <HorizontalScrollContainer>
          <div className="fromjs-value">
            <div
              className="fromjs-value__content"
              ref={el => {
                this.scrollToHighlightedChar(el, highlightedCharLineIndex);
              }}
            >
              {linesToShow.map((line, i) => {
                var beforeSpan = null;
                if (i === 0 && line.charOffsetStart > 0) {
                  beforeSpan = getEllipsisSpan("beforeEllipsis");
                }
                var afterSpan = null;
                if (
                  i === linesToShow.length - 1 &&
                  line.charOffsetEnd < val.length
                ) {
                  afterSpan = getEllipsisSpan("afterEllipsis");
                }
                return getLineComponent(line, beforeSpan, afterSpan);
              })}
            </div>
          </div>
        </HorizontalScrollContainer>
      );
      return ret;
    }
  }
  scrollToHighlightedChar(el, highlightedCharLineIndex) {
    if (!el) {
      return;
    }
    if (this.state.truncateText) {
      return;
    }
    var lineHeight = 18;
    var lineAtTop = highlightedCharLineIndex - 4;
    if (lineAtTop < 0) {
      lineAtTop = 0;
    }

    el.scrollTop = lineAtTop * lineHeight;
  }
  disableTruncateText() {
    if (this.props.text.length > 20000) {
      alert(
        "Refusing to expand text longer than 20,000 characters. It will just crash your browser."
      );
      return;
    }
    this.setState({ truncateText: false });
  }
}

class HorizontalScrollContainer extends React.Component<any, any> {
  render() {
    return (
      <div className="fromjs-horizontal-scroll-container">
        <div>{this.props.children}</div>
      </div>
    );
  }
}

let App = () => {
  return (
    <div>
      <button
        onClick={() => appState.set("debugMode", !appState.get("debugMode"))}
      >
        Debug
      </button>
      <DomInspector />
      <TraversalSteps />
    </div>
  );
};

App = root(appState, App);

ReactDom.render(<App />, document.querySelector("#app"));

// showSteps(522841433, 101);

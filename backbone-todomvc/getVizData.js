function resolveStackArray(stackArray, callback){
    stackArray = stackArray.filter(function(frame){
        if (frame.indexOf("string-trace.js") !== -1) {
            return false;
        }
        return true
    })

    var str = stackArray.join("\n")

    var err = ErrorStackParser.parse({stack: str});


    var sourceCache = {};
    var fnEls = document.getElementsByClassName("string-trace-fn")
    fnEls = Array.prototype.slice.call(fnEls)
    fnEls.forEach(function(el){
        var key = el.getAttribute("fn") + ".js"
        sourceCache[key] = el.innerHTML
    })

    var gps = new StackTraceGPS({sourceCache: sourceCache});

    var newStackFrames = new Array(err.length);
    var frame;
    err.forEach(function(frame, i){
        gps.pinpoint(frame).then(function(newFrame){
            newStackFrames[i] = newFrame.toString();
        }, function(){
            newStackFrames[i] = frame.toString();
            console.log("error", arguments)
        });
    })

    setTimeout(function(){
        callback(newStackFrames)
    }, 1000)
}

function resolveStacksInOrigin(origin, callback){
    var functionsToCall = []
    if (origin.stack){
        functionsToCall.push(function(callback){
            resolveStackArray(origin.stack, function(newStack){
                origin.resolvedStack = newStack
                callback()
            })
        })
    }
    if (origin.inputValues) {
        functionsToCall.push(function(callback){
            async.each(origin.inputValues, function(iv, callback){
                if (!iv) {callback();}
                else {
                    resolveStacksInOrigin(iv, callback)
                }
            }, function(){
                callback();
            })
        })
    }


    async.series(functionsToCall, function(){
        callback();
    })

}


function jsonifyElOriginOfEl(el, callback){
    console.log("jsonify for ", el)
    if (!el.__elOrigin){
        console.log("no elorigin for", el)
        callback({action: "no el origin"});
        return;
    }
    var children = [];
    var inputValues = []
    async.each(el.__elOrigin, function(elOrigin, callback){
        if (elOrigin.child){
            jsonifyElOriginOfEl(elOrigin.child, function(ssss){
                 children.push({
                    action: elOrigin.action,
                    elIdentifier: elOrigin.child.tagName,
                    children: ssss.children,
                    inputValues: ssss.inputValues
                })
                callback()
            })
        } else if (elOrigin.inputValues){
            async.map(elOrigin.inputValues, function(iv, callback){
                var origin = _.clone(iv.origin);
                resolveStacksInOrigin(origin, function(){
                    callback(null, origin)
                })

            }, function(err, inputV){
                inputValues = inputV
                callback()
            })

        }
    }, function(){
        callback({
            children: children,
            inputValues: inputValues
        })
    })
}

setTimeout(function(){
    jsonifyElOriginOfEl(document.body, function(oooo){

        window.oooo = oooo;
        console.log("got oooo")
    })
}, 5000)
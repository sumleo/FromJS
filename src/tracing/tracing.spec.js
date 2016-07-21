import {enableTracing, disableTracing} from "./tracing"
import {makeTraceObject} from "./FromJSString"

describe("Tracing", function(){
    beforeEach(function(){
        enableTracing();
    })
    afterEach(function(){
        disableTracing()
    })

    it("Tracks data read using localStorage.getItem", function(){
        localStorage.setItem("test", "hello")
        var value = localStorage.getItem("test")
        expect(value.origin).not.toBe(undefined);
    });

    it("Tracks data read using localStorage[key]", function(){
        localStorage.setItem("test", "hello")
        var value = localStorage["test"]
        expect(value.origin).not.toBe(undefined);
    });

    it("JSON.parse can parse flat JSON objects", function(){
        var parsed = JSON.parse('{"hello": "world"}')
        expect(parsed.hello.value).toBe("world")
    })

    it("JSON.parse can handle arrays in JSON objects", function(){
        var parsed = JSON.parse('{"hello": ["one", "two"]}')
        expect(parsed.hello.length).toBe(2)
        expect(parsed.hello[0].value).toBe("one")
    })

    it("JSON.parse can handle nested objects", function(){
        var parsed = JSON.parse('{"hello": {"there": "world"}}')
        expect(parsed.hello.there.value).toBe("world")
    })

    it("Processes code passed into eval", function(){
        // overwriting globally isn't great, but will find better solution later
        window.f__StringLiteral =  jasmine.createSpy()
        eval("a = 'Hello'")
        expect(window.f__StringLiteral).toHaveBeenCalled();
    })

    it("Array.join works with objects that have a custom toString function which returns a tracked string", function(){
        var obj = {
            toString: function(){
                return makeTraceObject({
                    value: "Hello",
                    origin: {}
                })
            }
        }

        var joined = [obj, obj].join("-")
        expect(joined).toBe("Hello-Hello")
    })

    it("Array.indexOf works with tracked strings", function(){
        var str = makeTraceObject({
            value: "Hello",
            origin: {}
        })
        var arr = [{str}]

        expect(arr.indexOf("Hello")).toBe(0)
        expect(arr.indexOf("Hi")).toBe(-1)
    })
})

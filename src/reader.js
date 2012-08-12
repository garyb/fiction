/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(function () {

    "use strict";

    function copyProps(src, out) {
        for (var k in src) {
            if (src.hasOwnProperty(k)) {
                out[k] = src[k];
            }
        }
        return out;
    }

    function form(type, value, extras) {
        var self = {
            type: type,
            value: value,
            toString: function () {
                var v = Array.isArray(self.value) ? "[" + self.value.join(", ") + "]" : self.value;
                return "{ type: " + self.type + ", value: " + v + " }";
            }
        };
        return extras ? copyProps(self, extras) : self;
    }

    function error(msg) {
        return function (state) {
            throw new Error(msg + " (line " + state.lineNum + ", char " + state.charNum + ")");
        };
    }

    var skip = { toString: function () { return "{skip}"; } };

    function newline(state) {
        state.i++;
        state.lineNum++;
        state.charNum = 1;
    }

    function readList(state) {
        var origState = state.clone();
        var openChr = state.input.charAt(state.i);
        var closeChr = openChr === "(" ? ")" :
                       openChr === "[" ? "]" :
                       openChr === "{" ? "}" :
                       error("Unknown list opener '" + openChr + "'")(state);
        var sym = openChr === "(" ? "paren" :
                  openChr === "[" ? "bracket" :
                  openChr === "{" ? "brace" : null;
        state.i++;
        var values = [];
        var closed = false;
        while (state.i < state.l) {
            if (state.input.charAt(state.i) === closeChr) {
                state.i++;
                closed = true;
                break;
            } else {
                var s = read(state);
                values.push(s);
            }
        }
        if (!closed) {
            error("Expected '" + closeChr + "'")(origState);
        }
        return form("list", values, { sym: sym });
    }

    function readNum(state) {
        var rxNum = /^[0-9\.]+$/;
        var rxHex = /^0x[0-9A-F]+$/i;
        var chunk = readToDelim(state);
        if (rxNum.test(chunk)) {
            return form("literal", parseFloat(chunk, 10));
        } else if (rxHex.test(chunk)) {
            return form("literal", parseInt(chunk, 16));
        } else {
            error("Invalid characters in number literal '" + chunk + "'")(state);
        }
    }

    function readString(state) {
        state.i++;
        var origState = state.clone();
        
        var chunk = "";
        var lastChr = null;
        var input = state.input;
        while (state.i < state.l) {
            var chr = input.charAt(state.i);
            if (chr === '"' && lastChr !== "\\") {
                break;
            } else {
                chunk += chr;
                lastChr = chr;
                state.i++;
                state.charNum++;
            }
        }
        
        if (state.i === state.l) {
            error("Unclosed string")(origState);
        }
        state.i++;
        return form("literal", '"' + chunk + '"');
    }

    function readSymbol(state) {
        // TODO: this might be a tad too relaxed
        return form("symbol", readToDelim(state));
    }

    function readComment(state) {
        var text = "";
        state.i++;
        while (state.i < state.l) {
            var chr = state.input.charAt(state.i++);
            if (chr === "\n") {
                break;
            } else if (chr !== "\r") {
                text += chr;
            }
        }
        return form("comment", text);
    }

    function readQuote(type) {
        return function (state) {
            state.i++;
            var x = read(state);
            if (x === null) {
                error("Expected something for " + type.substring(0, type.length - 1) + "ing")(state);
            }
            return form(type, x);
        };
    }
    
    function readUnquote(state) {
        state.i++;
        var type = "unquote";
        if (state.input.charAt(state.i) === "@") {
            type += "-splicing";
            state.i++;
        }
        var x = read(state);
        if (x === null) {
            error("Expected something for " + (type === "unquote" ? "unquoting" : type))(state);
        }
        return form(type, x);
    }
    
    var delimiters = {
        "(" : true,
        "[" : true,
        "{" : true,
        ")" : true,
        "]" : true,
        "}" : true,
        '"' : true,
        "'" : true,
        "`" : true,
        "," : true,
        ";" : true,
        " " : true,
        "\t": true,
        "\r": true,
        "\n": true
    };

    function readToDelim(state) {
        var chunk = "";
        var input = state.input;
        while (state.i < state.l) {
            var chr = input.charAt(state.i);
            if (delimiters.hasOwnProperty(chr)) {
                break;
            } else {
                chunk += chr;
                state.i++;
                state.charNum++;
            }
        }
        return chunk;
    }

    var readers = {
        "(" : readList,
        "[" : readList,
        "{" : readList,
        ")" : error("Unexpected ')' in input"),
        "]" : error("Unexpected ']' in input"),
        "}" : error("Unexpected '}' in input"),
        "'" : readQuote("quote"),
        "`" : readQuote("quasiquote"),
        "," : readUnquote,
        ";" : readComment,
        "0" : readNum,
        "1" : readNum,
        "2" : readNum,
        "3" : readNum,
        "4" : readNum,
        "5" : readNum,
        "6" : readNum,
        "7" : readNum,
        "8" : readNum,
        "9" : readNum,
        '"' : readString,
        " " : skip,
        "\t": skip,
        "\n": newline,
        "\r": skip
    };

    function read(state) {
        while (state.i < state.l) {
            var chr = state.input.charAt(state.i);
            var reader = readers[chr];
            if (reader === skip) {
                state.i++;
                continue;
            } else if (reader !== undefined) {
                return reader(state);
            } else {
                return readSymbol(state);
            }
        }
        return null;
    }

    function readAll(input) {
        var result = [];
        var state = {
            input: input,
            i: 0,
            l: input.length,
            lineNum: 1,
            charNum: 1,
            clone: function () {
                return copyProps(state, {});
            }
        };
        while (true) {
            var atom = read(state);
            if (atom === null) {
                return result;
            } else {
                result.push(atom);
            }
        }
    }

    return { read: readAll };

});
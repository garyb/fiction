/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";

    function error(msg) {
        return function (state) {
            throw new Error(msg + " (line " + state.lineNum + ", char " + state.charNum + ")");
        };
    }
    
    var createForm = util.createForm;

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
        consumeWhitespace(state);
        while (state.i < state.l) {
            if (state.input.charAt(state.i) === closeChr) {
                state.i++;
                closed = true;
                break;
            } else {
                values.push(read(state));
                consumeWhitespace(state);
            }
        }
        if (!closed) {
            error("Expected '" + closeChr + "'")(origState);
        }
        return createForm("list", values, { sym: sym });
    }

    function readNum(state) {
        var rxNum = /^[0-9\.]+$/;
        var rxHex = /^0x[0-9A-F]+$/i;
        var chunk = readToDelim(state);
        if (rxNum.test(chunk)) {
            return createForm("literal", parseFloat(chunk, 10));
        } else if (rxHex.test(chunk)) {
            return createForm("literal", parseInt(chunk, 16));
        } else {
            error("Invalid characters in number literal '" + chunk + "'")(state);
        }
    }
    
    var escapeable = util.makeMap(["b", "t", "n", "v", "f", "r", "u", '"', "'", "\\"]);

    function readString(state) {
        state.i++;
        var origState = state.clone();
        var chunk = "";
        var escaped = false;
        var input = state.input;
        while (state.i < state.l) {
            var chr = input.charAt(state.i);
            if (chr === '"' && !escaped) {
                break;
            }
            if (escaped) {
                if (escapeable.hasOwnProperty(chr)) {
                    chunk += "\\" + chr;
                    escaped = false;
                } else {
                    error("Invalid escape sequence '\\" + chr + "'")(state);
                }
            } else if (chr === "\\") {
                escaped = true;
            } else {
                chunk += chr;
            }
            state.i++;
            state.charNum++;
        }
        
        if (state.i === state.l) {
            error("Unclosed string")(origState);
        }
        state.i++;
        return createForm("literal", chunk);
    }
    
    function readBool(state) {
        var chr = state.input.charAt(state.i++);
        return createForm("literal", chr === "t");
    }
    
    function readRegex(state) {
        state.i++;
        var origState = state.clone();
        var chunk = "";
        var escaped = false;
        var input = state.input;
        while (state.i < state.l) {
            var chr = input.charAt(state.i);
            if (chr === '/' && !escaped) {
                break;
            }
            if (escaped) {
                escaped = false;
            } else if (chr === "\\") {
                escaped = true;
            }
            chunk += chr;
            state.i++;
            state.charNum++;
        }
        if (state.i === state.l) {
            error("Unclosed regular expression")(origState);
        }
        state.i++;
        var options = readToDelim(state);
        if (!/^[gim]*$/.test(options)) {
            error("Invalid regular expression options '" + options + "'")(state);
        }
        return createForm("literal", new RegExp(chunk.slice(1, chunk.length), options));
    }
    
    var specials = {
        "t": readBool,
        "f": readBool,
        "/": readRegex
    };
    
    function readSpecial(state) {
        state.i++;
        var chr = state.input.charAt(state.i);
        var sr = specials[chr];
        if (sr) {
            return sr(state);
        } else {
            error("reader: bad syntax '#" + chr + "'", state);
        }
    }

    function readSymbol(state) {
        // TODO: this might be a tad too relaxed
        return createForm("symbol", readToDelim(state));
    }

    function readComment(state) {
        state.i++;
        while (state.i < state.l) {
            var chr = state.input.charAt(state.i);
            if (chr === "\n") {
                break;
            }
            state.i++;
        }
        return read(state);
    }

    function readQuote(type) {
        return function (state) {
            state.i++;
            var x = read(state);
            if (x === null) {
                error("Expected something for " + type.substring(0, type.length - 1) + "ing")(state);
            }
            return createForm("list", [createForm("symbol", type), x]);
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
        return createForm("list", [createForm("symbol", type), x]);
    }
    
    var whitespace = util.makeMap([
        " ", "\t", "\r", "\n"
    ]);
    
    function consumeWhitespace(state) {
        while (state.i < state.l) {
            var chr = state.input.charAt(state.i);
            if (chr === "\n") {
                state.lineNum++;
                state.charNum = 1;
            } else if (!whitespace.hasOwnProperty(chr)) {
                break;
            }
            state.i++;
        }
    }
    
    var delimiters = util.copyProps(whitespace, util.makeMap([
        "(", "[", "{", ")", "]", "}", 
        '"', "'", "`", ",", ";"
    ]));

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
        '#' : readSpecial
    };

    function read(state) {
        consumeWhitespace(state);
        if (state.i < state.l) {
            var chr = state.input.charAt(state.i);
            var reader = readers[chr];
            if (reader) {
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
                return util.copyProps(state, {});
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
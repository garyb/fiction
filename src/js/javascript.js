/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";
    
    var makeMap = util.makeMap;
    
    var keywords = makeMap([
        "this",
        "new",
        
        "delete",
        "void",
        "typeof",
        
        "var",
        
        "if",
        "else",
        
        "do",
        "while",
        "for",
        "in",
        
        "continue",
        "break",
        "return",
        "with",
        "switch",
        "case",
        "default",
        
        "throw",
        "try",
        "catch",
        "finally",
        
        "function",
        "instanceof"
    ]);
    
    var reserved = makeMap([
        "abstract",
        "enum",
        "int",
        "short",
        "boolean",
        "export",
        "interface",
        "static",
        "byte",
        "extends",
        "long",
        "super",
        "char",
        "final",
        "native",
        "synchronized",
        "class",
        "float",
        "package",
        "throws",
        "const",
        "goto",
        "private",
        "transient",
        "debugger",
        "implements",
        "protected",
        "volatile ",
        "double",
        "import",
        "public"
    ]);
    
    var values = makeMap([
        "null",
        "true",
        "false",
        
        "NaN",
        "Infinity",
        "undefined"
    ]);   
    
    var functions = makeMap([
        "eval",
        
        "parseInt",
        "parseFloat",
        "isNaN",
        "isFinite",
        
        "decodeURI",
        "decodeURIComponent",
        "encodeURI",
        "encodeURIComponent"
    ]);
    
    var objects = makeMap([
        "Object",
        "Function",
        "Array",
        "String",
        "Boolean",
        "Number",
        "Date",
        "RegExp",
        "Error",
        "EvalError",
        "RangeError",
        "ReferenceError",
        "SyntaxError",
        "TypeError",
        "URIError",
        "Math"
    ]);
    
    var operators = makeMap([
        "<",
        ">",
        "<=",
        ">=",
        "==",
        "!=",
        "===",
        "!==",
        "+",
        "-",
        "*",
        "%",
        "++",
        "--",
        "<<",
        ">>",
        ">>>",
        "&",
        "|",
        "^",
        "!",
        "~",
        "&&",
        "||",
        "=",
        "+=",
        "-=",
        "*=",
        "%=",
        "<<=",
        ">>=",
        ">>>=",
        "&=",
        "|=",
        "^="
    ]);
    
    var allSymbols = {};
    util.copyProps(keywords, allSymbols);
    util.copyProps(reserved, allSymbols);
    util.copyProps(values, allSymbols);
    util.copyProps(functions, allSymbols);
    util.copyProps(objects, allSymbols);

    return {
        keywords: keywords, 
        reserved: reserved,
        values: values,
        functions: functions,
        objects: objects,
        operators: operators,
        allSymbols: allSymbols
    };

});
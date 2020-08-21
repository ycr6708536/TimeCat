var TimeCat = (function (exports) {
    'use strict'

    class NodeStore {
        constructor() {
            this.createNodeId = () => NodeStore.nodeId++
            this.init()
        }
        init() {
            this.nodeMap = new Map()
            this.idMap = new WeakMap()
        }
        reset() {
            this.nodeMap.clear()
        }
        getNode(id) {
            return this.nodeMap.get(id) || null
        }
        addNode(node, id = this.createNodeId()) {
            this.idMap.set(node, id)
            this.nodeMap.set(id, node)
            return id
        }
        removeNode(id) {
            this.nodeMap.delete(id)
            this.idMap.delete(this.getNode(id))
        }
        getNodeId(node) {
            return this.idMap.get(node)
        }
        updateNode(id, node) {
            this.idMap.set(node, id)
            this.nodeMap.set(id, node)
        }
    }
    NodeStore.nodeId = 1
    const nodeStore = new NodeStore()

    var RecordType
    ;(function (RecordType) {
        RecordType[(RecordType['HEAD'] = 0)] = 'HEAD'
        RecordType[(RecordType['SNAPSHOT'] = 1)] = 'SNAPSHOT'
        RecordType[(RecordType['WINDOW'] = 2)] = 'WINDOW'
        RecordType[(RecordType['SCROLL'] = 3)] = 'SCROLL'
        RecordType[(RecordType['MOUSE'] = 4)] = 'MOUSE'
        RecordType[(RecordType['DOM'] = 5)] = 'DOM'
        RecordType[(RecordType['FORM_EL'] = 6)] = 'FORM_EL'
        RecordType[(RecordType['LOCATION'] = 7)] = 'LOCATION'
        RecordType[(RecordType['AUDIO'] = 8)] = 'AUDIO'
        RecordType[(RecordType['CANVAS'] = 9)] = 'CANVAS'
        RecordType[(RecordType['TERMINATE'] = 10)] = 'TERMINATE'
    })(RecordType || (RecordType = {}))
    var FormElementEvent
    ;(function (FormElementEvent) {
        FormElementEvent[(FormElementEvent['PROP'] = 0)] = 'PROP'
        FormElementEvent[(FormElementEvent['INPUT'] = 1)] = 'INPUT'
        FormElementEvent[(FormElementEvent['CHANGE'] = 2)] = 'CHANGE'
        FormElementEvent[(FormElementEvent['FOCUS'] = 3)] = 'FOCUS'
        FormElementEvent[(FormElementEvent['BLUR'] = 4)] = 'BLUR'
    })(FormElementEvent || (FormElementEvent = {}))
    var MouseEventType
    ;(function (MouseEventType) {
        MouseEventType[(MouseEventType['MOVE'] = 0)] = 'MOVE'
        MouseEventType[(MouseEventType['CLICK'] = 1)] = 'CLICK'
    })(MouseEventType || (MouseEventType = {}))
    var TransactionMode
    ;(function (TransactionMode) {
        TransactionMode['READONLY'] = 'readonly'
        TransactionMode['READWRITE'] = 'readwrite'
        TransactionMode['VERSIONCHANGE'] = 'versionchange'
    })(TransactionMode || (TransactionMode = {}))

    class IndexedDBOperator {
        constructor(DBName, version, storeName, callback) {
            this.listeners = []
            this.DBName = DBName
            this.version = version
            this.storeName = storeName
            const request = window.indexedDB.open(DBName, version)
            request.onerror = () => {
                console.error('open indexedDB on error')
            }
            request.onsuccess = () => {
                this.db = request.result
                callback(this.db)
            }
            request.onupgradeneeded = e => {
                const db = e.target.result
                if (!db.objectStoreNames.contains(storeName)) {
                    const objectStore = db.createObjectStore(storeName, { autoIncrement: true, keyPath: 'id' })
                    objectStore.createIndex('type', 'type', { unique: false })
                    objectStore.createIndex('data', 'data', { unique: false })
                    objectStore.createIndex('time', 'time', { unique: false })
                }
            }
        }
        withIDBStore(type) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(this.storeName, type)
                transaction.oncomplete = () => {}
                transaction.onabort = transaction.onerror = () => {
                    reject(transaction.error)
                    throw new Error('process indexedDB on error')
                }
                resolve(transaction.objectStore(this.storeName))
            })
        }
        getStore() {
            return this.withIDBStore(TransactionMode.READWRITE)
        }
        async add(data) {
            const store = await this.getStore()
            store.add(data)
            this.triggerEvent('add')
        }
        async addRecord(data) {
            await this.add(data)
        }
        async clear() {
            const store = await this.getStore()
            store.clear()
        }
        async readAllRecords() {
            return await this.readRecords()
        }
        async readRecords(options) {
            const { limit } = options || {}
            const store = await this.getStore()
            const records = []
            return new Promise(resolve => {
                store.openCursor().onsuccess = event => {
                    const cursor = event.target.result
                    if (limit && records.length >= limit) {
                        return resolve(records)
                    }
                    if (cursor) {
                        records.push(cursor.value)
                        cursor.continue()
                        return
                    }
                    resolve(records)
                }
            }).then(arr => (arr.length ? arr : null))
        }
        async deleteRecords(options) {
            const { lowerBound, upperBound } = options || {}
            if (lowerBound && upperBound) {
                const keyRange = IDBKeyRange.bound(lowerBound, upperBound)
                const store = await this.getStore()
                store.delete(keyRange)
            }
        }
        async count() {
            const store = await this.getStore()
            return new Promise(resolve => {
                store.count().onsuccess = event => {
                    const count = event.target.result
                    resolve(count)
                }
            })
        }
        triggerEvent(name) {
            this.listeners.filter(item => item.name === name).forEach(item => item.fn())
        }
        listen(name, callback) {
            this.listeners.push({ name, fn: callback })
        }
    }
    const getDBOperator = new Promise(resolve => {
        const DBOperator = new IndexedDBOperator('cat_db', 1, 'cat_data', () => {
            resolve(DBOperator)
        })
    })

    const initState = {
        speed: 0
    }
    var PlayerTypes
    ;(function (PlayerTypes) {
        PlayerTypes['SPEED'] = 'SPEED'
    })(PlayerTypes || (PlayerTypes = {}))
    function PlayerReducer(state, action) {
        if (!state) {
            state = initState
        }
        if (!action) {
            return state
        }
        const { type, data } = action
        switch (type) {
            case PlayerTypes.SPEED:
                return {
                    ...state,
                    ...data
                }
            default:
                return state
        }
    }

    const initState$1 = {
        frame: 0,
        length: 0,
        curTime: 0,
        startTime: 0,
        endTime: 0
    }
    var ProgressTypes
    ;(function (ProgressTypes) {
        ProgressTypes['FORWARD'] = 'FORWARD'
        ProgressTypes['BACKWARD'] = 'BACKWARD'
        ProgressTypes['INFO'] = 'INFO'
    })(ProgressTypes || (ProgressTypes = {}))
    function progressReducer(state, action) {
        if (!state) {
            state = initState$1
        }
        if (!action) {
            return state
        }
        const { type, data } = action
        switch (type) {
            case ProgressTypes.FORWARD:
                return {
                    ...state,
                    frame: data.frame,
                    curTime: data.curTime
                }
            case ProgressTypes.BACKWARD:
                return {
                    ...state,
                    frame: data.frame
                }
            case ProgressTypes.INFO:
                return {
                    ...state,
                    ...data
                }
            default:
                return state
        }
    }

    function objectEquals(x, y) {
        if (x === null || x === undefined || y === null || y === undefined) {
            return x === y
        }
        if (x.constructor !== y.constructor) {
            return false
        }
        if (x instanceof Function) {
            return x === y
        }
        if (x instanceof RegExp) {
            return x === y
        }
        if (x === y || x.valueOf() === y.valueOf()) {
            return true
        }
        if (Array.isArray(x) && x.length !== y.length) {
            return false
        }
        if (x instanceof Date) {
            return false
        }
        if (!(x instanceof Object)) {
            return false
        }
        if (!(y instanceof Object)) {
            return false
        }
        const p = Object.keys(x)
        return (
            Object.keys(y).every(function (i) {
                return p.indexOf(i) !== -1
            }) &&
            p.every(function (i) {
                return objectEquals(x[i], y[i])
            })
        )
    }
    function throttle(func, wait, options = { leading: false, trailing: false }) {
        let context
        let args
        let result
        let timeout = null
        let previous = 0
        const later = function () {
            previous = options.leading === false ? 0 : Date.now()
            timeout = null
            result = func.apply(context, args)
            if (!timeout) context = args = null
        }
        return function () {
            const now = Date.now()
            if (!previous && options.leading === false) previous = now
            const remaining = wait - (now - previous)
            context = this
            args = arguments
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout)
                    timeout = null
                }
                previous = now
                result = func.apply(context, args)
                if (!timeout) context = args = null
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining)
            }
            return result
        }
    }
    function debounce(
        func,
        waitMilliseconds,
        options = {
            isImmediate: false
        }
    ) {
        let timeoutId
        return function (...args) {
            const context = this
            const doLater = function () {
                timeoutId = undefined
                if (!options.isImmediate) {
                    func.apply(context, args)
                }
            }
            const shouldCallNow = options.isImmediate && timeoutId === undefined
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId)
            }
            timeoutId = setTimeout(doLater, waitMilliseconds)
            if (shouldCallNow) {
                func.apply(context, args)
            }
        }
    }

    function createStore(reducer, initState = {}) {
        let state = initState
        const topics = {
            all: []
        }
        function subscribe(...args) {
            let type = 'all'
            let listener
            if (typeof args[0] === 'string') {
                type = args[0]
                listener = args[1]
            } else {
                listener = args[0]
            }
            if (!topics[type]) {
                topics[type] = []
            }
            topics[type].push(listener)
        }
        function dispatch(action) {
            const oldState = state
            state = reducer(state, action)
            if (!action) {
                if (topics['all']) {
                    topics['all'].forEach(listener => listener(state))
                }
                return
            }
            const topicName = getTypeInTopics(action.type)
            if (topicName && topics[topicName]) {
                return topics[topicName].forEach(listener => {
                    if (!objectEquals(state[topicName], oldState[topicName])) {
                        listener(state[topicName])
                    }
                })
            }
        }
        function getState(name) {
            const s = state
            if (name) {
                return s[name]
            }
            return s
        }
        function getTypeInTopics(type) {
            const topics = {
                player: Object.keys(PlayerTypes),
                progress: Object.keys(ProgressTypes)
            }
            for (const [key, enums] of Object.entries(topics)) {
                if (enums.includes(type)) {
                    return key
                }
            }
        }
        return {
            subscribe,
            dispatch,
            getState
        }
    }

    function combineReducers(reducers) {
        const reducerKeys = Object.keys(reducers)
        return function combination(state, action) {
            const nextState = {}
            for (let i = 0; i < reducerKeys.length; i++) {
                const key = reducerKeys[i]
                const reducer = reducers[key]
                const previousStateForKey = state[key]
                const nextStateForKey = reducer(previousStateForKey, action)
                nextState[key] = nextStateForKey
            }
            return nextState
        }
    }

    const reducer = combineReducers({
        player: PlayerReducer,
        progress: progressReducer
    })
    const reduxStore = createStore(reducer)

    var commonjsGlobal =
        typeof globalThis !== 'undefined'
            ? globalThis
            : typeof window !== 'undefined'
            ? window
            : typeof global !== 'undefined'
            ? global
            : typeof self !== 'undefined'
            ? self
            : {}

    function unwrapExports(x) {
        return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x
    }

    function createCommonjsModule(fn, module) {
        return (module = { exports: {} }), fn(module, module.exports), module.exports
    }

    var diff = createCommonjsModule(function (module, exports) {
        /*!

     diff v4.0.1

    Software License Agreement (BSD License)

    Copyright (c) 2009-2015, Kevin Decker <kpdecker@gmail.com>

    All rights reserved.

    Redistribution and use of this software in source and binary forms, with or without modification,
    are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above
      copyright notice, this list of conditions and the
      following disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the
      following disclaimer in the documentation and/or other
      materials provided with the distribution.

    * Neither the name of Kevin Decker nor the names of its
      contributors may be used to endorse or promote products
      derived from this software without specific prior
      written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
    IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
    FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
    CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
    DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
    IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
    OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    @license
    */
        ;(function (global, factory) {
            factory(exports)
        })(commonjsGlobal, function (exports) {
            function Diff() {}
            Diff.prototype = {
                diff: function diff(oldString, newString) {
                    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {}
                    var callback = options.callback

                    if (typeof options === 'function') {
                        callback = options
                        options = {}
                    }

                    this.options = options
                    var self = this

                    function done(value) {
                        if (callback) {
                            setTimeout(function () {
                                callback(undefined, value)
                            }, 0)
                            return true
                        } else {
                            return value
                        }
                    } // Allow subclasses to massage the input prior to running

                    oldString = this.castInput(oldString)
                    newString = this.castInput(newString)
                    oldString = this.removeEmpty(this.tokenize(oldString))
                    newString = this.removeEmpty(this.tokenize(newString))
                    var newLen = newString.length,
                        oldLen = oldString.length
                    var editLength = 1
                    var maxEditLength = newLen + oldLen
                    var bestPath = [
                        {
                            newPos: -1,
                            components: []
                        }
                    ] // Seed editLength = 0, i.e. the content starts with the same values

                    var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0)

                    if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
                        // Identity per the equality and tokenizer
                        return done([
                            {
                                value: this.join(newString),
                                count: newString.length
                            }
                        ])
                    } // Main worker method. checks all permutations of a given edit length for acceptance.

                    function execEditLength() {
                        for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
                            var basePath = void 0

                            var addPath = bestPath[diagonalPath - 1],
                                removePath = bestPath[diagonalPath + 1],
                                _oldPos = (removePath ? removePath.newPos : 0) - diagonalPath

                            if (addPath) {
                                // No one else is going to attempt to use this value, clear it
                                bestPath[diagonalPath - 1] = undefined
                            }

                            var canAdd = addPath && addPath.newPos + 1 < newLen,
                                canRemove = removePath && 0 <= _oldPos && _oldPos < oldLen

                            if (!canAdd && !canRemove) {
                                // If this path is a terminal then prune
                                bestPath[diagonalPath] = undefined
                                continue
                            } // Select the diagonal that we want to branch from. We select the prior
                            // path whose position in the new string is the farthest from the origin
                            // and does not pass the bounds of the diff graph

                            if (!canAdd || (canRemove && addPath.newPos < removePath.newPos)) {
                                basePath = clonePath(removePath)
                                self.pushComponent(basePath.components, undefined, true)
                            } else {
                                basePath = addPath // No need to clone, we've pulled it from the list

                                basePath.newPos++
                                self.pushComponent(basePath.components, true, undefined)
                            }

                            _oldPos = self.extractCommon(basePath, newString, oldString, diagonalPath) // If we have hit the end of both strings, then we are done

                            if (basePath.newPos + 1 >= newLen && _oldPos + 1 >= oldLen) {
                                return done(
                                    buildValues(self, basePath.components, newString, oldString, self.useLongestToken)
                                )
                            } else {
                                // Otherwise track this path as a potential candidate and continue.
                                bestPath[diagonalPath] = basePath
                            }
                        }

                        editLength++
                    } // Performs the length of edit iteration. Is a bit fugly as this has to support the
                    // sync and async mode which is never fun. Loops over execEditLength until a value
                    // is produced.

                    if (callback) {
                        ;(function exec() {
                            setTimeout(function () {
                                // This should not happen, but we want to be safe.

                                /* istanbul ignore next */
                                if (editLength > maxEditLength) {
                                    return callback()
                                }

                                if (!execEditLength()) {
                                    exec()
                                }
                            }, 0)
                        })()
                    } else {
                        while (editLength <= maxEditLength) {
                            var ret = execEditLength()

                            if (ret) {
                                return ret
                            }
                        }
                    }
                },
                pushComponent: function pushComponent(components, added, removed) {
                    var last = components[components.length - 1]

                    if (last && last.added === added && last.removed === removed) {
                        // We need to clone here as the component clone operation is just
                        // as shallow array clone
                        components[components.length - 1] = {
                            count: last.count + 1,
                            added: added,
                            removed: removed
                        }
                    } else {
                        components.push({
                            count: 1,
                            added: added,
                            removed: removed
                        })
                    }
                },
                extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
                    var newLen = newString.length,
                        oldLen = oldString.length,
                        newPos = basePath.newPos,
                        oldPos = newPos - diagonalPath,
                        commonCount = 0

                    while (
                        newPos + 1 < newLen &&
                        oldPos + 1 < oldLen &&
                        this.equals(newString[newPos + 1], oldString[oldPos + 1])
                    ) {
                        newPos++
                        oldPos++
                        commonCount++
                    }

                    if (commonCount) {
                        basePath.components.push({
                            count: commonCount
                        })
                    }

                    basePath.newPos = newPos
                    return oldPos
                },
                equals: function equals(left, right) {
                    if (this.options.comparator) {
                        return this.options.comparator(left, right)
                    } else {
                        return left === right || (this.options.ignoreCase && left.toLowerCase() === right.toLowerCase())
                    }
                },
                removeEmpty: function removeEmpty(array) {
                    var ret = []

                    for (var i = 0; i < array.length; i++) {
                        if (array[i]) {
                            ret.push(array[i])
                        }
                    }

                    return ret
                },
                castInput: function castInput(value) {
                    return value
                },
                tokenize: function tokenize(value) {
                    return value.split('')
                },
                join: function join(chars) {
                    return chars.join('')
                }
            }

            function buildValues(diff, components, newString, oldString, useLongestToken) {
                var componentPos = 0,
                    componentLen = components.length,
                    newPos = 0,
                    oldPos = 0

                for (; componentPos < componentLen; componentPos++) {
                    var component = components[componentPos]

                    if (!component.removed) {
                        if (!component.added && useLongestToken) {
                            var value = newString.slice(newPos, newPos + component.count)
                            value = value.map(function (value, i) {
                                var oldValue = oldString[oldPos + i]
                                return oldValue.length > value.length ? oldValue : value
                            })
                            component.value = diff.join(value)
                        } else {
                            component.value = diff.join(newString.slice(newPos, newPos + component.count))
                        }

                        newPos += component.count // Common case

                        if (!component.added) {
                            oldPos += component.count
                        }
                    } else {
                        component.value = diff.join(oldString.slice(oldPos, oldPos + component.count))
                        oldPos += component.count // Reverse add and remove so removes are output first to match common convention
                        // The diffing algorithm is tied to add then remove output and this is the simplest
                        // route to get the desired output with minimal overhead.

                        if (componentPos && components[componentPos - 1].added) {
                            var tmp = components[componentPos - 1]
                            components[componentPos - 1] = components[componentPos]
                            components[componentPos] = tmp
                        }
                    }
                } // Special case handle for when one terminal is ignored (i.e. whitespace).
                // For this case we merge the terminal into the prior string and drop the change.
                // This is only available for string mode.

                var lastComponent = components[componentLen - 1]

                if (
                    componentLen > 1 &&
                    typeof lastComponent.value === 'string' &&
                    (lastComponent.added || lastComponent.removed) &&
                    diff.equals('', lastComponent.value)
                ) {
                    components[componentLen - 2].value += lastComponent.value
                    components.pop()
                }

                return components
            }

            function clonePath(path) {
                return {
                    newPos: path.newPos,
                    components: path.components.slice(0)
                }
            }

            var characterDiff = new Diff()
            function diffChars(oldStr, newStr, options) {
                return characterDiff.diff(oldStr, newStr, options)
            }

            function generateOptions(options, defaults) {
                if (typeof options === 'function') {
                    defaults.callback = options
                } else if (options) {
                    for (var name in options) {
                        /* istanbul ignore else */
                        if (options.hasOwnProperty(name)) {
                            defaults[name] = options[name]
                        }
                    }
                }

                return defaults
            }

            //
            // Ranges and exceptions:
            // Latin-1 Supplement, 0080–00FF
            //  - U+00D7  × Multiplication sign
            //  - U+00F7  ÷ Division sign
            // Latin Extended-A, 0100–017F
            // Latin Extended-B, 0180–024F
            // IPA Extensions, 0250–02AF
            // Spacing Modifier Letters, 02B0–02FF
            //  - U+02C7  ˇ &#711;  Caron
            //  - U+02D8  ˘ &#728;  Breve
            //  - U+02D9  ˙ &#729;  Dot Above
            //  - U+02DA  ˚ &#730;  Ring Above
            //  - U+02DB  ˛ &#731;  Ogonek
            //  - U+02DC  ˜ &#732;  Small Tilde
            //  - U+02DD  ˝ &#733;  Double Acute Accent
            // Latin Extended Additional, 1E00–1EFF

            var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/
            var reWhitespace = /\S/
            var wordDiff = new Diff()

            wordDiff.equals = function (left, right) {
                if (this.options.ignoreCase) {
                    left = left.toLowerCase()
                    right = right.toLowerCase()
                }

                return (
                    left === right ||
                    (this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right))
                )
            }

            wordDiff.tokenize = function (value) {
                var tokens = value.split(/(\s+|[()[\]{}'"]|\b)/) // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.

                for (var i = 0; i < tokens.length - 1; i++) {
                    // If we have an empty string in the next field and we have only word chars before and after, merge
                    if (
                        !tokens[i + 1] &&
                        tokens[i + 2] &&
                        extendedWordChars.test(tokens[i]) &&
                        extendedWordChars.test(tokens[i + 2])
                    ) {
                        tokens[i] += tokens[i + 2]
                        tokens.splice(i + 1, 2)
                        i--
                    }
                }

                return tokens
            }

            function diffWords(oldStr, newStr, options) {
                options = generateOptions(options, {
                    ignoreWhitespace: true
                })
                return wordDiff.diff(oldStr, newStr, options)
            }
            function diffWordsWithSpace(oldStr, newStr, options) {
                return wordDiff.diff(oldStr, newStr, options)
            }

            var lineDiff = new Diff()

            lineDiff.tokenize = function (value) {
                var retLines = [],
                    linesAndNewlines = value.split(/(\n|\r\n)/) // Ignore the final empty token that occurs if the string ends with a new line

                if (!linesAndNewlines[linesAndNewlines.length - 1]) {
                    linesAndNewlines.pop()
                } // Merge the content and line separators into single tokens

                for (var i = 0; i < linesAndNewlines.length; i++) {
                    var line = linesAndNewlines[i]

                    if (i % 2 && !this.options.newlineIsToken) {
                        retLines[retLines.length - 1] += line
                    } else {
                        if (this.options.ignoreWhitespace) {
                            line = line.trim()
                        }

                        retLines.push(line)
                    }
                }

                return retLines
            }

            function diffLines(oldStr, newStr, callback) {
                return lineDiff.diff(oldStr, newStr, callback)
            }
            function diffTrimmedLines(oldStr, newStr, callback) {
                var options = generateOptions(callback, {
                    ignoreWhitespace: true
                })
                return lineDiff.diff(oldStr, newStr, options)
            }

            var sentenceDiff = new Diff()

            sentenceDiff.tokenize = function (value) {
                return value.split(/(\S.+?[.!?])(?=\s+|$)/)
            }

            function diffSentences(oldStr, newStr, callback) {
                return sentenceDiff.diff(oldStr, newStr, callback)
            }

            var cssDiff = new Diff()

            cssDiff.tokenize = function (value) {
                return value.split(/([{}:;,]|\s+)/)
            }

            function diffCss(oldStr, newStr, callback) {
                return cssDiff.diff(oldStr, newStr, callback)
            }

            function _typeof(obj) {
                if (typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol') {
                    _typeof = function (obj) {
                        return typeof obj
                    }
                } else {
                    _typeof = function (obj) {
                        return obj &&
                            typeof Symbol === 'function' &&
                            obj.constructor === Symbol &&
                            obj !== Symbol.prototype
                            ? 'symbol'
                            : typeof obj
                    }
                }

                return _typeof(obj)
            }

            function _toConsumableArray(arr) {
                return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread()
            }

            function _arrayWithoutHoles(arr) {
                if (Array.isArray(arr)) {
                    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]

                    return arr2
                }
            }

            function _iterableToArray(iter) {
                if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === '[object Arguments]')
                    return Array.from(iter)
            }

            function _nonIterableSpread() {
                throw new TypeError('Invalid attempt to spread non-iterable instance')
            }

            var objectPrototypeToString = Object.prototype.toString
            var jsonDiff = new Diff() // Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
            // dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:

            jsonDiff.useLongestToken = true
            jsonDiff.tokenize = lineDiff.tokenize

            jsonDiff.castInput = function (value) {
                var _this$options = this.options,
                    undefinedReplacement = _this$options.undefinedReplacement,
                    _this$options$stringi = _this$options.stringifyReplacer,
                    stringifyReplacer =
                        _this$options$stringi === void 0
                            ? function (k, v) {
                                  return typeof v === 'undefined' ? undefinedReplacement : v
                              }
                            : _this$options$stringi
                return typeof value === 'string'
                    ? value
                    : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), stringifyReplacer, '  ')
            }

            jsonDiff.equals = function (left, right) {
                return Diff.prototype.equals.call(
                    jsonDiff,
                    left.replace(/,([\r\n])/g, '$1'),
                    right.replace(/,([\r\n])/g, '$1')
                )
            }

            function diffJson(oldObj, newObj, options) {
                return jsonDiff.diff(oldObj, newObj, options)
            } // This function handles the presence of circular references by bailing out when encountering an
            // object that is already on the "stack" of items being processed. Accepts an optional replacer

            function canonicalize(obj, stack, replacementStack, replacer, key) {
                stack = stack || []
                replacementStack = replacementStack || []

                if (replacer) {
                    obj = replacer(key, obj)
                }

                var i

                for (i = 0; i < stack.length; i += 1) {
                    if (stack[i] === obj) {
                        return replacementStack[i]
                    }
                }

                var canonicalizedObj

                if ('[object Array]' === objectPrototypeToString.call(obj)) {
                    stack.push(obj)
                    canonicalizedObj = new Array(obj.length)
                    replacementStack.push(canonicalizedObj)

                    for (i = 0; i < obj.length; i += 1) {
                        canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, key)
                    }

                    stack.pop()
                    replacementStack.pop()
                    return canonicalizedObj
                }

                if (obj && obj.toJSON) {
                    obj = obj.toJSON()
                }

                if (_typeof(obj) === 'object' && obj !== null) {
                    stack.push(obj)
                    canonicalizedObj = {}
                    replacementStack.push(canonicalizedObj)

                    var sortedKeys = [],
                        _key

                    for (_key in obj) {
                        /* istanbul ignore else */
                        if (obj.hasOwnProperty(_key)) {
                            sortedKeys.push(_key)
                        }
                    }

                    sortedKeys.sort()

                    for (i = 0; i < sortedKeys.length; i += 1) {
                        _key = sortedKeys[i]
                        canonicalizedObj[_key] = canonicalize(obj[_key], stack, replacementStack, replacer, _key)
                    }

                    stack.pop()
                    replacementStack.pop()
                } else {
                    canonicalizedObj = obj
                }

                return canonicalizedObj
            }

            var arrayDiff = new Diff()

            arrayDiff.tokenize = function (value) {
                return value.slice()
            }

            arrayDiff.join = arrayDiff.removeEmpty = function (value) {
                return value
            }

            function diffArrays(oldArr, newArr, callback) {
                return arrayDiff.diff(oldArr, newArr, callback)
            }

            function parsePatch(uniDiff) {
                var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}
                var diffstr = uniDiff.split(/\r\n|[\n\v\f\r\x85]/),
                    delimiters = uniDiff.match(/\r\n|[\n\v\f\r\x85]/g) || [],
                    list = [],
                    i = 0

                function parseIndex() {
                    var index = {}
                    list.push(index) // Parse diff metadata

                    while (i < diffstr.length) {
                        var line = diffstr[i] // File header found, end parsing diff metadata

                        if (/^(\-\-\-|\+\+\+|@@)\s/.test(line)) {
                            break
                        } // Diff index

                        var header = /^(?:Index:|diff(?: -r \w+)+)\s+(.+?)\s*$/.exec(line)

                        if (header) {
                            index.index = header[1]
                        }

                        i++
                    } // Parse file headers if they are defined. Unified diff requires them, but
                    // there's no technical issues to have an isolated hunk without file header

                    parseFileHeader(index)
                    parseFileHeader(index) // Parse hunks

                    index.hunks = []

                    while (i < diffstr.length) {
                        var _line = diffstr[i]

                        if (/^(Index:|diff|\-\-\-|\+\+\+)\s/.test(_line)) {
                            break
                        } else if (/^@@/.test(_line)) {
                            index.hunks.push(parseHunk())
                        } else if (_line && options.strict) {
                            // Ignore unexpected content unless in strict mode
                            throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(_line))
                        } else {
                            i++
                        }
                    }
                } // Parses the --- and +++ headers, if none are found, no lines
                // are consumed.

                function parseFileHeader(index) {
                    var fileHeader = /^(---|\+\+\+)\s+(.*)$/.exec(diffstr[i])

                    if (fileHeader) {
                        var keyPrefix = fileHeader[1] === '---' ? 'old' : 'new'
                        var data = fileHeader[2].split('\t', 2)
                        var fileName = data[0].replace(/\\\\/g, '\\')

                        if (/^".*"$/.test(fileName)) {
                            fileName = fileName.substr(1, fileName.length - 2)
                        }

                        index[keyPrefix + 'FileName'] = fileName
                        index[keyPrefix + 'Header'] = (data[1] || '').trim()
                        i++
                    }
                } // Parses a hunk
                // This assumes that we are at the start of a hunk.

                function parseHunk() {
                    var chunkHeaderIndex = i,
                        chunkHeaderLine = diffstr[i++],
                        chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
                    var hunk = {
                        oldStart: +chunkHeader[1],
                        oldLines: +chunkHeader[2] || 1,
                        newStart: +chunkHeader[3],
                        newLines: +chunkHeader[4] || 1,
                        lines: [],
                        linedelimiters: []
                    }
                    var addCount = 0,
                        removeCount = 0

                    for (; i < diffstr.length; i++) {
                        // Lines starting with '---' could be mistaken for the "remove line" operation
                        // But they could be the header for the next file. Therefore prune such cases out.
                        if (
                            diffstr[i].indexOf('--- ') === 0 &&
                            i + 2 < diffstr.length &&
                            diffstr[i + 1].indexOf('+++ ') === 0 &&
                            diffstr[i + 2].indexOf('@@') === 0
                        ) {
                            break
                        }

                        var operation = diffstr[i].length == 0 && i != diffstr.length - 1 ? ' ' : diffstr[i][0]

                        if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
                            hunk.lines.push(diffstr[i])
                            hunk.linedelimiters.push(delimiters[i] || '\n')

                            if (operation === '+') {
                                addCount++
                            } else if (operation === '-') {
                                removeCount++
                            } else if (operation === ' ') {
                                addCount++
                                removeCount++
                            }
                        } else {
                            break
                        }
                    } // Handle the empty block count case

                    if (!addCount && hunk.newLines === 1) {
                        hunk.newLines = 0
                    }

                    if (!removeCount && hunk.oldLines === 1) {
                        hunk.oldLines = 0
                    } // Perform optional sanity checking

                    if (options.strict) {
                        if (addCount !== hunk.newLines) {
                            throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1))
                        }

                        if (removeCount !== hunk.oldLines) {
                            throw new Error(
                                'Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1)
                            )
                        }
                    }

                    return hunk
                }

                while (i < diffstr.length) {
                    parseIndex()
                }

                return list
            }

            // Iterator that traverses in the range of [min, max], stepping
            // by distance from a given start position. I.e. for [0, 4], with
            // start of 2, this will iterate 2, 3, 1, 4, 0.
            function distanceIterator(start, minLine, maxLine) {
                var wantForward = true,
                    backwardExhausted = false,
                    forwardExhausted = false,
                    localOffset = 1
                return function iterator() {
                    if (wantForward && !forwardExhausted) {
                        if (backwardExhausted) {
                            localOffset++
                        } else {
                            wantForward = false
                        } // Check if trying to fit beyond text length, and if not, check it fits
                        // after offset location (or desired location on first iteration)

                        if (start + localOffset <= maxLine) {
                            return localOffset
                        }

                        forwardExhausted = true
                    }

                    if (!backwardExhausted) {
                        if (!forwardExhausted) {
                            wantForward = true
                        } // Check if trying to fit before text beginning, and if not, check it fits
                        // before offset location

                        if (minLine <= start - localOffset) {
                            return -localOffset++
                        }

                        backwardExhausted = true
                        return iterator()
                    } // We tried to fit hunk before text beginning and beyond text length, then
                    // hunk can't fit on the text. Return undefined
                }
            }

            function applyPatch(source, uniDiff) {
                var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {}

                if (typeof uniDiff === 'string') {
                    uniDiff = parsePatch(uniDiff)
                }

                if (Array.isArray(uniDiff)) {
                    if (uniDiff.length > 1) {
                        throw new Error('applyPatch only works with a single input.')
                    }

                    uniDiff = uniDiff[0]
                } // Apply the diff to the input

                var lines = source.split(/\r\n|[\n\v\f\r\x85]/),
                    delimiters = source.match(/\r\n|[\n\v\f\r\x85]/g) || [],
                    hunks = uniDiff.hunks,
                    compareLine =
                        options.compareLine ||
                        function (lineNumber, line, operation, patchContent) {
                            return line === patchContent
                        },
                    errorCount = 0,
                    fuzzFactor = options.fuzzFactor || 0,
                    minLine = 0,
                    offset = 0,
                    removeEOFNL,
                    addEOFNL
                /**
                 * Checks if the hunk exactly fits on the provided location
                 */

                function hunkFits(hunk, toPos) {
                    for (var j = 0; j < hunk.lines.length; j++) {
                        var line = hunk.lines[j],
                            operation = line.length > 0 ? line[0] : ' ',
                            content = line.length > 0 ? line.substr(1) : line

                        if (operation === ' ' || operation === '-') {
                            // Context sanity check
                            if (!compareLine(toPos + 1, lines[toPos], operation, content)) {
                                errorCount++

                                if (errorCount > fuzzFactor) {
                                    return false
                                }
                            }

                            toPos++
                        }
                    }

                    return true
                } // Search best fit offsets for each hunk based on the previous ones

                for (var i = 0; i < hunks.length; i++) {
                    var hunk = hunks[i],
                        maxLine = lines.length - hunk.oldLines,
                        localOffset = 0,
                        toPos = offset + hunk.oldStart - 1
                    var iterator = distanceIterator(toPos, minLine, maxLine)

                    for (; localOffset !== undefined; localOffset = iterator()) {
                        if (hunkFits(hunk, toPos + localOffset)) {
                            hunk.offset = offset += localOffset
                            break
                        }
                    }

                    if (localOffset === undefined) {
                        return false
                    } // Set lower text limit to end of the current hunk, so next ones don't try
                    // to fit over already patched text

                    minLine = hunk.offset + hunk.oldStart + hunk.oldLines
                } // Apply patch hunks

                var diffOffset = 0

                for (var _i = 0; _i < hunks.length; _i++) {
                    var _hunk = hunks[_i],
                        _toPos = _hunk.oldStart + _hunk.offset + diffOffset - 1

                    diffOffset += _hunk.newLines - _hunk.oldLines

                    if (_toPos < 0) {
                        // Creating a new file
                        _toPos = 0
                    }

                    for (var j = 0; j < _hunk.lines.length; j++) {
                        var line = _hunk.lines[j],
                            operation = line.length > 0 ? line[0] : ' ',
                            content = line.length > 0 ? line.substr(1) : line,
                            delimiter = _hunk.linedelimiters[j]

                        if (operation === ' ') {
                            _toPos++
                        } else if (operation === '-') {
                            lines.splice(_toPos, 1)
                            delimiters.splice(_toPos, 1)
                            /* istanbul ignore else */
                        } else if (operation === '+') {
                            lines.splice(_toPos, 0, content)
                            delimiters.splice(_toPos, 0, delimiter)
                            _toPos++
                        } else if (operation === '\\') {
                            var previousOperation = _hunk.lines[j - 1] ? _hunk.lines[j - 1][0] : null

                            if (previousOperation === '+') {
                                removeEOFNL = true
                            } else if (previousOperation === '-') {
                                addEOFNL = true
                            }
                        }
                    }
                } // Handle EOFNL insertion/removal

                if (removeEOFNL) {
                    while (!lines[lines.length - 1]) {
                        lines.pop()
                        delimiters.pop()
                    }
                } else if (addEOFNL) {
                    lines.push('')
                    delimiters.push('\n')
                }

                for (var _k = 0; _k < lines.length - 1; _k++) {
                    lines[_k] = lines[_k] + delimiters[_k]
                }

                return lines.join('')
            } // Wrapper that supports multiple file patches via callbacks.

            function applyPatches(uniDiff, options) {
                if (typeof uniDiff === 'string') {
                    uniDiff = parsePatch(uniDiff)
                }

                var currentIndex = 0

                function processIndex() {
                    var index = uniDiff[currentIndex++]

                    if (!index) {
                        return options.complete()
                    }

                    options.loadFile(index, function (err, data) {
                        if (err) {
                            return options.complete(err)
                        }

                        var updatedContent = applyPatch(data, index, options)
                        options.patched(index, updatedContent, function (err) {
                            if (err) {
                                return options.complete(err)
                            }

                            processIndex()
                        })
                    })
                }

                processIndex()
            }

            function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
                if (!options) {
                    options = {}
                }

                if (typeof options.context === 'undefined') {
                    options.context = 4
                }

                var diff = diffLines(oldStr, newStr, options)
                diff.push({
                    value: '',
                    lines: []
                }) // Append an empty value to make cleanup easier

                function contextLines(lines) {
                    return lines.map(function (entry) {
                        return ' ' + entry
                    })
                }

                var hunks = []
                var oldRangeStart = 0,
                    newRangeStart = 0,
                    curRange = [],
                    oldLine = 1,
                    newLine = 1

                var _loop = function _loop(i) {
                    var current = diff[i],
                        lines = current.lines || current.value.replace(/\n$/, '').split('\n')
                    current.lines = lines

                    if (current.added || current.removed) {
                        var _curRange

                        // If we have previous context, start with that
                        if (!oldRangeStart) {
                            var prev = diff[i - 1]
                            oldRangeStart = oldLine
                            newRangeStart = newLine

                            if (prev) {
                                curRange = options.context > 0 ? contextLines(prev.lines.slice(-options.context)) : []
                                oldRangeStart -= curRange.length
                                newRangeStart -= curRange.length
                            }
                        } // Output our changes

                        ;(_curRange = curRange).push.apply(
                            _curRange,
                            _toConsumableArray(
                                lines.map(function (entry) {
                                    return (current.added ? '+' : '-') + entry
                                })
                            )
                        ) // Track the updated file position

                        if (current.added) {
                            newLine += lines.length
                        } else {
                            oldLine += lines.length
                        }
                    } else {
                        // Identical context lines. Track line changes
                        if (oldRangeStart) {
                            // Close out any changes that have been output (or join overlapping)
                            if (lines.length <= options.context * 2 && i < diff.length - 2) {
                                var _curRange2

                                // Overlapping
                                ;(_curRange2 = curRange).push.apply(_curRange2, _toConsumableArray(contextLines(lines)))
                            } else {
                                var _curRange3

                                // end the range and output
                                var contextSize = Math.min(lines.length, options.context)

                                ;(_curRange3 = curRange).push.apply(
                                    _curRange3,
                                    _toConsumableArray(contextLines(lines.slice(0, contextSize)))
                                )

                                var hunk = {
                                    oldStart: oldRangeStart,
                                    oldLines: oldLine - oldRangeStart + contextSize,
                                    newStart: newRangeStart,
                                    newLines: newLine - newRangeStart + contextSize,
                                    lines: curRange
                                }

                                if (i >= diff.length - 2 && lines.length <= options.context) {
                                    // EOF is inside this hunk
                                    var oldEOFNewline = /\n$/.test(oldStr)
                                    var newEOFNewline = /\n$/.test(newStr)
                                    var noNlBeforeAdds = lines.length == 0 && curRange.length > hunk.oldLines

                                    if (!oldEOFNewline && noNlBeforeAdds) {
                                        // special case: old has no eol and no trailing context; no-nl can end up before adds
                                        curRange.splice(hunk.oldLines, 0, '\\ No newline at end of file')
                                    }

                                    if ((!oldEOFNewline && !noNlBeforeAdds) || !newEOFNewline) {
                                        curRange.push('\\ No newline at end of file')
                                    }
                                }

                                hunks.push(hunk)
                                oldRangeStart = 0
                                newRangeStart = 0
                                curRange = []
                            }
                        }

                        oldLine += lines.length
                        newLine += lines.length
                    }
                }

                for (var i = 0; i < diff.length; i++) {
                    _loop(i)
                }

                return {
                    oldFileName: oldFileName,
                    newFileName: newFileName,
                    oldHeader: oldHeader,
                    newHeader: newHeader,
                    hunks: hunks
                }
            }
            function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
                var diff = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options)
                var ret = []

                if (oldFileName == newFileName) {
                    ret.push('Index: ' + oldFileName)
                }

                ret.push('===================================================================')
                ret.push(
                    '--- ' + diff.oldFileName + (typeof diff.oldHeader === 'undefined' ? '' : '\t' + diff.oldHeader)
                )
                ret.push(
                    '+++ ' + diff.newFileName + (typeof diff.newHeader === 'undefined' ? '' : '\t' + diff.newHeader)
                )

                for (var i = 0; i < diff.hunks.length; i++) {
                    var hunk = diff.hunks[i]
                    ret.push(
                        '@@ -' +
                            hunk.oldStart +
                            ',' +
                            hunk.oldLines +
                            ' +' +
                            hunk.newStart +
                            ',' +
                            hunk.newLines +
                            ' @@'
                    )
                    ret.push.apply(ret, hunk.lines)
                }

                return ret.join('\n') + '\n'
            }
            function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
                return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options)
            }

            function arrayEqual(a, b) {
                if (a.length !== b.length) {
                    return false
                }

                return arrayStartsWith(a, b)
            }
            function arrayStartsWith(array, start) {
                if (start.length > array.length) {
                    return false
                }

                for (var i = 0; i < start.length; i++) {
                    if (start[i] !== array[i]) {
                        return false
                    }
                }

                return true
            }

            function calcLineCount(hunk) {
                var _calcOldNewLineCount = calcOldNewLineCount(hunk.lines),
                    oldLines = _calcOldNewLineCount.oldLines,
                    newLines = _calcOldNewLineCount.newLines

                if (oldLines !== undefined) {
                    hunk.oldLines = oldLines
                } else {
                    delete hunk.oldLines
                }

                if (newLines !== undefined) {
                    hunk.newLines = newLines
                } else {
                    delete hunk.newLines
                }
            }
            function merge(mine, theirs, base) {
                mine = loadPatch(mine, base)
                theirs = loadPatch(theirs, base)
                var ret = {} // For index we just let it pass through as it doesn't have any necessary meaning.
                // Leaving sanity checks on this to the API consumer that may know more about the
                // meaning in their own context.

                if (mine.index || theirs.index) {
                    ret.index = mine.index || theirs.index
                }

                if (mine.newFileName || theirs.newFileName) {
                    if (!fileNameChanged(mine)) {
                        // No header or no change in ours, use theirs (and ours if theirs does not exist)
                        ret.oldFileName = theirs.oldFileName || mine.oldFileName
                        ret.newFileName = theirs.newFileName || mine.newFileName
                        ret.oldHeader = theirs.oldHeader || mine.oldHeader
                        ret.newHeader = theirs.newHeader || mine.newHeader
                    } else if (!fileNameChanged(theirs)) {
                        // No header or no change in theirs, use ours
                        ret.oldFileName = mine.oldFileName
                        ret.newFileName = mine.newFileName
                        ret.oldHeader = mine.oldHeader
                        ret.newHeader = mine.newHeader
                    } else {
                        // Both changed... figure it out
                        ret.oldFileName = selectField(ret, mine.oldFileName, theirs.oldFileName)
                        ret.newFileName = selectField(ret, mine.newFileName, theirs.newFileName)
                        ret.oldHeader = selectField(ret, mine.oldHeader, theirs.oldHeader)
                        ret.newHeader = selectField(ret, mine.newHeader, theirs.newHeader)
                    }
                }

                ret.hunks = []
                var mineIndex = 0,
                    theirsIndex = 0,
                    mineOffset = 0,
                    theirsOffset = 0

                while (mineIndex < mine.hunks.length || theirsIndex < theirs.hunks.length) {
                    var mineCurrent = mine.hunks[mineIndex] || {
                            oldStart: Infinity
                        },
                        theirsCurrent = theirs.hunks[theirsIndex] || {
                            oldStart: Infinity
                        }

                    if (hunkBefore(mineCurrent, theirsCurrent)) {
                        // This patch does not overlap with any of the others, yay.
                        ret.hunks.push(cloneHunk(mineCurrent, mineOffset))
                        mineIndex++
                        theirsOffset += mineCurrent.newLines - mineCurrent.oldLines
                    } else if (hunkBefore(theirsCurrent, mineCurrent)) {
                        // This patch does not overlap with any of the others, yay.
                        ret.hunks.push(cloneHunk(theirsCurrent, theirsOffset))
                        theirsIndex++
                        mineOffset += theirsCurrent.newLines - theirsCurrent.oldLines
                    } else {
                        // Overlap, merge as best we can
                        var mergedHunk = {
                            oldStart: Math.min(mineCurrent.oldStart, theirsCurrent.oldStart),
                            oldLines: 0,
                            newStart: Math.min(
                                mineCurrent.newStart + mineOffset,
                                theirsCurrent.oldStart + theirsOffset
                            ),
                            newLines: 0,
                            lines: []
                        }
                        mergeLines(
                            mergedHunk,
                            mineCurrent.oldStart,
                            mineCurrent.lines,
                            theirsCurrent.oldStart,
                            theirsCurrent.lines
                        )
                        theirsIndex++
                        mineIndex++
                        ret.hunks.push(mergedHunk)
                    }
                }

                return ret
            }

            function loadPatch(param, base) {
                if (typeof param === 'string') {
                    if (/^@@/m.test(param) || /^Index:/m.test(param)) {
                        return parsePatch(param)[0]
                    }

                    if (!base) {
                        throw new Error('Must provide a base reference or pass in a patch')
                    }

                    return structuredPatch(undefined, undefined, base, param)
                }

                return param
            }

            function fileNameChanged(patch) {
                return patch.newFileName && patch.newFileName !== patch.oldFileName
            }

            function selectField(index, mine, theirs) {
                if (mine === theirs) {
                    return mine
                } else {
                    index.conflict = true
                    return {
                        mine: mine,
                        theirs: theirs
                    }
                }
            }

            function hunkBefore(test, check) {
                return test.oldStart < check.oldStart && test.oldStart + test.oldLines < check.oldStart
            }

            function cloneHunk(hunk, offset) {
                return {
                    oldStart: hunk.oldStart,
                    oldLines: hunk.oldLines,
                    newStart: hunk.newStart + offset,
                    newLines: hunk.newLines,
                    lines: hunk.lines
                }
            }

            function mergeLines(hunk, mineOffset, mineLines, theirOffset, theirLines) {
                // This will generally result in a conflicted hunk, but there are cases where the context
                // is the only overlap where we can successfully merge the content here.
                var mine = {
                        offset: mineOffset,
                        lines: mineLines,
                        index: 0
                    },
                    their = {
                        offset: theirOffset,
                        lines: theirLines,
                        index: 0
                    } // Handle any leading content

                insertLeading(hunk, mine, their)
                insertLeading(hunk, their, mine) // Now in the overlap content. Scan through and select the best changes from each.

                while (mine.index < mine.lines.length && their.index < their.lines.length) {
                    var mineCurrent = mine.lines[mine.index],
                        theirCurrent = their.lines[their.index]

                    if (
                        (mineCurrent[0] === '-' || mineCurrent[0] === '+') &&
                        (theirCurrent[0] === '-' || theirCurrent[0] === '+')
                    ) {
                        // Both modified ...
                        mutualChange(hunk, mine, their)
                    } else if (mineCurrent[0] === '+' && theirCurrent[0] === ' ') {
                        var _hunk$lines

                        // Mine inserted
                        ;(_hunk$lines = hunk.lines).push.apply(_hunk$lines, _toConsumableArray(collectChange(mine)))
                    } else if (theirCurrent[0] === '+' && mineCurrent[0] === ' ') {
                        var _hunk$lines2

                        // Theirs inserted
                        ;(_hunk$lines2 = hunk.lines).push.apply(_hunk$lines2, _toConsumableArray(collectChange(their)))
                    } else if (mineCurrent[0] === '-' && theirCurrent[0] === ' ') {
                        // Mine removed or edited
                        removal(hunk, mine, their)
                    } else if (theirCurrent[0] === '-' && mineCurrent[0] === ' ') {
                        // Their removed or edited
                        removal(hunk, their, mine, true)
                    } else if (mineCurrent === theirCurrent) {
                        // Context identity
                        hunk.lines.push(mineCurrent)
                        mine.index++
                        their.index++
                    } else {
                        // Context mismatch
                        conflict(hunk, collectChange(mine), collectChange(their))
                    }
                } // Now push anything that may be remaining

                insertTrailing(hunk, mine)
                insertTrailing(hunk, their)
                calcLineCount(hunk)
            }

            function mutualChange(hunk, mine, their) {
                var myChanges = collectChange(mine),
                    theirChanges = collectChange(their)

                if (allRemoves(myChanges) && allRemoves(theirChanges)) {
                    // Special case for remove changes that are supersets of one another
                    if (
                        arrayStartsWith(myChanges, theirChanges) &&
                        skipRemoveSuperset(their, myChanges, myChanges.length - theirChanges.length)
                    ) {
                        var _hunk$lines3

                        ;(_hunk$lines3 = hunk.lines).push.apply(_hunk$lines3, _toConsumableArray(myChanges))

                        return
                    } else if (
                        arrayStartsWith(theirChanges, myChanges) &&
                        skipRemoveSuperset(mine, theirChanges, theirChanges.length - myChanges.length)
                    ) {
                        var _hunk$lines4

                        ;(_hunk$lines4 = hunk.lines).push.apply(_hunk$lines4, _toConsumableArray(theirChanges))

                        return
                    }
                } else if (arrayEqual(myChanges, theirChanges)) {
                    var _hunk$lines5

                    ;(_hunk$lines5 = hunk.lines).push.apply(_hunk$lines5, _toConsumableArray(myChanges))

                    return
                }

                conflict(hunk, myChanges, theirChanges)
            }

            function removal(hunk, mine, their, swap) {
                var myChanges = collectChange(mine),
                    theirChanges = collectContext(their, myChanges)

                if (theirChanges.merged) {
                    var _hunk$lines6

                    ;(_hunk$lines6 = hunk.lines).push.apply(_hunk$lines6, _toConsumableArray(theirChanges.merged))
                } else {
                    conflict(hunk, swap ? theirChanges : myChanges, swap ? myChanges : theirChanges)
                }
            }

            function conflict(hunk, mine, their) {
                hunk.conflict = true
                hunk.lines.push({
                    conflict: true,
                    mine: mine,
                    theirs: their
                })
            }

            function insertLeading(hunk, insert, their) {
                while (insert.offset < their.offset && insert.index < insert.lines.length) {
                    var line = insert.lines[insert.index++]
                    hunk.lines.push(line)
                    insert.offset++
                }
            }

            function insertTrailing(hunk, insert) {
                while (insert.index < insert.lines.length) {
                    var line = insert.lines[insert.index++]
                    hunk.lines.push(line)
                }
            }

            function collectChange(state) {
                var ret = [],
                    operation = state.lines[state.index][0]

                while (state.index < state.lines.length) {
                    var line = state.lines[state.index] // Group additions that are immediately after subtractions and treat them as one "atomic" modify change.

                    if (operation === '-' && line[0] === '+') {
                        operation = '+'
                    }

                    if (operation === line[0]) {
                        ret.push(line)
                        state.index++
                    } else {
                        break
                    }
                }

                return ret
            }

            function collectContext(state, matchChanges) {
                var changes = [],
                    merged = [],
                    matchIndex = 0,
                    contextChanges = false,
                    conflicted = false

                while (matchIndex < matchChanges.length && state.index < state.lines.length) {
                    var change = state.lines[state.index],
                        match = matchChanges[matchIndex] // Once we've hit our add, then we are done

                    if (match[0] === '+') {
                        break
                    }

                    contextChanges = contextChanges || change[0] !== ' '
                    merged.push(match)
                    matchIndex++ // Consume any additions in the other block as a conflict to attempt
                    // to pull in the remaining context after this

                    if (change[0] === '+') {
                        conflicted = true

                        while (change[0] === '+') {
                            changes.push(change)
                            change = state.lines[++state.index]
                        }
                    }

                    if (match.substr(1) === change.substr(1)) {
                        changes.push(change)
                        state.index++
                    } else {
                        conflicted = true
                    }
                }

                if ((matchChanges[matchIndex] || '')[0] === '+' && contextChanges) {
                    conflicted = true
                }

                if (conflicted) {
                    return changes
                }

                while (matchIndex < matchChanges.length) {
                    merged.push(matchChanges[matchIndex++])
                }

                return {
                    merged: merged,
                    changes: changes
                }
            }

            function allRemoves(changes) {
                return changes.reduce(function (prev, change) {
                    return prev && change[0] === '-'
                }, true)
            }

            function skipRemoveSuperset(state, removeChanges, delta) {
                for (var i = 0; i < delta; i++) {
                    var changeContent = removeChanges[removeChanges.length - delta + i].substr(1)

                    if (state.lines[state.index + i] !== ' ' + changeContent) {
                        return false
                    }
                }

                state.index += delta
                return true
            }

            function calcOldNewLineCount(lines) {
                var oldLines = 0
                var newLines = 0
                lines.forEach(function (line) {
                    if (typeof line !== 'string') {
                        var myCount = calcOldNewLineCount(line.mine)
                        var theirCount = calcOldNewLineCount(line.theirs)

                        if (oldLines !== undefined) {
                            if (myCount.oldLines === theirCount.oldLines) {
                                oldLines += myCount.oldLines
                            } else {
                                oldLines = undefined
                            }
                        }

                        if (newLines !== undefined) {
                            if (myCount.newLines === theirCount.newLines) {
                                newLines += myCount.newLines
                            } else {
                                newLines = undefined
                            }
                        }
                    } else {
                        if (newLines !== undefined && (line[0] === '+' || line[0] === ' ')) {
                            newLines++
                        }

                        if (oldLines !== undefined && (line[0] === '-' || line[0] === ' ')) {
                            oldLines++
                        }
                    }
                })
                return {
                    oldLines: oldLines,
                    newLines: newLines
                }
            }

            // See: http://code.google.com/p/google-diff-match-patch/wiki/API
            function convertChangesToDMP(changes) {
                var ret = [],
                    change,
                    operation

                for (var i = 0; i < changes.length; i++) {
                    change = changes[i]

                    if (change.added) {
                        operation = 1
                    } else if (change.removed) {
                        operation = -1
                    } else {
                        operation = 0
                    }

                    ret.push([operation, change.value])
                }

                return ret
            }

            function convertChangesToXML(changes) {
                var ret = []

                for (var i = 0; i < changes.length; i++) {
                    var change = changes[i]

                    if (change.added) {
                        ret.push('<ins>')
                    } else if (change.removed) {
                        ret.push('<del>')
                    }

                    ret.push(escapeHTML(change.value))

                    if (change.added) {
                        ret.push('</ins>')
                    } else if (change.removed) {
                        ret.push('</del>')
                    }
                }

                return ret.join('')
            }

            function escapeHTML(s) {
                var n = s
                n = n.replace(/&/g, '&amp;')
                n = n.replace(/</g, '&lt;')
                n = n.replace(/>/g, '&gt;')
                n = n.replace(/"/g, '&quot;')
                return n
            }

            /* See LICENSE file for terms of use */

            exports.Diff = Diff
            exports.diffChars = diffChars
            exports.diffWords = diffWords
            exports.diffWordsWithSpace = diffWordsWithSpace
            exports.diffLines = diffLines
            exports.diffTrimmedLines = diffTrimmedLines
            exports.diffSentences = diffSentences
            exports.diffCss = diffCss
            exports.diffJson = diffJson
            exports.diffArrays = diffArrays
            exports.structuredPatch = structuredPatch
            exports.createTwoFilesPatch = createTwoFilesPatch
            exports.createPatch = createPatch
            exports.applyPatch = applyPatch
            exports.applyPatches = applyPatches
            exports.parsePatch = parsePatch
            exports.merge = merge
            exports.convertChangesToDMP = convertChangesToDMP
            exports.convertChangesToXML = convertChangesToXML
            exports.canonicalize = canonicalize

            Object.defineProperty(exports, '__esModule', { value: true })
        })
    })

    var diff$1 = unwrapExports(diff)

    const ENCODE_TYPE = {
        BASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
        BASE_URL: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    }
    class Radix64 {
        atob(str, type = 'BASE_URL') {
            if (str.length === 1) {
                return this.decode(str, type)
            }
            const len = str.length
            const digit = ENCODE_TYPE[type].length
            let sum = 0
            let carry = 0
            for (let i = len - 1; i >= 0; i--) {
                const s = str[i]
                sum += this.decode(s, type) * Math.pow(digit, carry++)
            }
            return sum
        }
        btoa(num, type = 'BASE_URL') {
            const len = ENCODE_TYPE[type].length
            if (num < len) {
                return this.encode(num, type)
            }
            return '' + this.btoa(Math.floor(num / len), type) + this.encode(num & (len - 1), type)
        }
        decode(str, type) {
            const data = ENCODE_TYPE[type].indexOf(str)
            return data
        }
        encode(num, type) {
            const n = num & (ENCODE_TYPE.BASE.length - 1)
            return ENCODE_TYPE[type][n]
        }
    }
    const radix64 = new Radix64()

    function logErrorOverload(e) {
        const msg = e.message || e
        console.error(`TimeCat Error: ${msg}`)
        return msg
    }
    const logError = logErrorOverload
    function getTime() {
        return Math.floor(performance.timing.navigationStart + performance.now())
    }
    function getRadix64TimeStr() {
        return radix64.btoa(getTime())
    }
    function getRandomCode(len = 8) {
        const code = (Math.random() * 20 + 16).toString(36).substring(2, len + 2)
        return code.toUpperCase()
    }
    function secondToDate(ms) {
        if (ms <= 0) {
            ms = 0
        }
        const [h, m, s] = [Math.floor(ms / 3600), Math.floor((ms / 60) % 60), Math.floor(ms % 60)]
        const timeStr = [h, m, s].map(i => (i <= 9 ? '0' + i : i)).join(':')
        return timeStr.replace(/^00\:/, '')
    }
    function toTimeStamp(timeStr) {
        const parts = timeStr.split(':')
        if (parts.length === 2) {
            const [min, sec] = parts
            return (+min * 60 + +sec) * 1000
        }
        const [hour, min, sec] = parts
        return (+hour * 3600 + +min * 60 + +sec) * 1000
    }
    function isSnapshot(frame) {
        return frame.type === RecordType.SNAPSHOT && !frame.data.frameId
    }
    function classifyRecords(records) {
        const packs = []
        function isAudioBufferStr(frame) {
            return frame.data.type === 'base64'
        }
        function isSameHEAD(head, compare) {
            return head.href === compare.href
        }
        let replayPack
        let replayData
        records.forEach((record, index) => {
            const next = records[index + 1]
            switch (record.type) {
                case RecordType.HEAD:
                    const headData = record.data
                    const lastHEAD = replayPack && replayPack.head
                    if (lastHEAD && isSameHEAD(headData, lastHEAD)) {
                        break
                    }
                    replayPack = {
                        head: headData,
                        body: []
                    }
                    if (next && !next.data.frameId) {
                        if (replayPack) {
                            packs.push(replayPack)
                        }
                    }
                    break
                case RecordType.SNAPSHOT:
                    if (!record.data.frameId) {
                        replayData = {
                            snapshot: record,
                            records: [],
                            audio: {
                                src: '',
                                bufferStrList: [],
                                subtitles: [],
                                opts: {}
                            }
                        }
                        if (replayData && replayPack) {
                            replayPack.body.push(replayData)
                        }
                    } else {
                        replayData.records.push(record)
                    }
                    break
                case RecordType.AUDIO:
                    if (isAudioBufferStr(record)) {
                        const audioData = record
                        replayData.audio.bufferStrList.push(...audioData.data.data)
                    } else {
                        replayData.audio.opts = record.data.data
                    }
                    break
                default:
                    replayData.records.push(record)
                    break
            }
        })
        return packs
    }
    async function delay(t = 200) {
        return new Promise(r => {
            setTimeout(() => r(), t)
        })
    }
    function isVNode(n) {
        return !!n.tag
    }
    function download(src, name) {
        const tag = document.createElement('a')
        tag.download = name
        if (typeof src === 'string') {
            tag.href = src
            tag.click()
        } else {
            tag.href = URL.createObjectURL(src)
            tag.click()
            URL.revokeObjectURL(tag.href)
        }
    }
    function getStrDiffPatches(oldStr, newStr) {
        return getPatches(diff$1.diffChars(oldStr, newStr))
    }
    function revertStrByPatches(str, changes) {
        changes.forEach(change => {
            const { type, value, len } = change
            switch (type) {
                case 'add':
                    str = str.substring(0, change.index) + value + str.substring(change.index)
                    break
                case 'rm':
                    str = str.substring(0, change.index) + str.substring(change.index + len)
                    break
            }
        })
        return str
    }
    function getPatches(changes) {
        let index = 0
        const patches = changes
            .map(change => {
                const { added: add, removed: rm, value, count } = change
                const len = count || 0
                if (add) {
                    const ret = {
                        index,
                        type: 'add',
                        value
                    }
                    index += len
                    return ret
                } else if (rm) {
                    const ret = {
                        index,
                        type: 'rm',
                        len
                    }
                    return ret
                }
                index += len
            })
            .filter(Boolean)
        return patches
    }

    class RecoverNative {
        constructor() {
            const frame = document.createElement('iframe')
            frame.style.display = 'none'
            frame.style.visibility = 'hidden'
            document.body.appendChild(frame)
            this.safeWindow = frame.contentWindow
        }
        getObjByPath(path, target) {
            if (!path) {
                return target
            }
            const pathArray = this.getMethodAtPath(path)
            let method = target
            pathArray.forEach(key => {
                method = method[key]
            })
            return method
        }
        getMethodAtPath(path) {
            return path.split('.')
        }
        recoverMethod(path) {
            const currFn = this.getObjByPath(path, window)
            if (!this.isNative(currFn)) {
                const nativeFn = this.getObjByPath(path, this.safeWindow)
                this.recover(path, nativeFn)
            }
        }
        recover(path, fn) {
            const pathArray = this.getMethodAtPath(path)
            const [methodName, ..._path] = pathArray.reverse()
            const host = this.getObjByPath(_path.reverse().join('.'), window)
            host[methodName] = fn
        }
        isNative(value) {
            const toString = Object.prototype.toString
            const fnToString = Function.prototype.toString
            const reHostCtor = /^\[object .+?Constructor\]$/
            const reNative = RegExp(
                '^' +
                    String(toString)
                        .replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&')
                        .replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') +
                    '$'
            )
            const type = typeof value
            return type == 'function'
                ? reNative.test(fnToString.call(value))
                : (value && type == 'object' && reHostCtor.test(toString.call(value))) || false
        }
    }
    const recoverNative = new RecoverNative()
    recoverNative.recoverMethod('MutationObserver')

    const snapshot = () => window.__ReplayData__ && window.__ReplayData__.snapshot.data
    const href = () => snapshot().href
    function filteringTemplate(tpl) {
        return tpl
    }
    function isElementNode(node) {
        return node.nodeType === Node.ELEMENT_NODE
    }
    function filteringScriptTag(str) {
        const reg = /<\/script>/g
        return str.replace(reg, '<\\/script>')
    }
    function proxyResource(url) {
        const { proxy } = window.__ReplayOptions__
        if (proxy) {
            const proxyUrl = stitchingLink(proxy, url)
            return proxyUrl
        }
        return url
    }
    function stitchingLink(pre, next) {
        if (pre.endsWith('/') || next.startsWith('/')) {
            return pre + next
        }
        return pre + '/' + next
    }
    function completeCssHref(str, parentVNode) {
        return str.replace(/(url\(['"]?((\/{1,2}|\.\.?\/)[^'"]*?)['"]?(?=\)))/g, (string, b, url) => {
            if (!url.startsWith('data')) {
                const baseUrl =
                    (parentVNode === null || parentVNode === void 0 ? void 0 : parentVNode.attrs['css-url']) || href()
                const newUrl = new URL(url, baseUrl)
                return string.replace(url, newUrl.href)
            }
            return string
        })
    }
    function completeAttrHref(str, node) {
        if (str.startsWith('data')) {
            return str
        }
        if (node) {
            setTimeout(() => {
                const doc = node.getRootNode()
                const context = doc.defaultView
                const { href, path } =
                    (context === null || context === void 0 ? void 0 : context.__ReplayLocation__) || {}
                if (path && href) {
                    const relationHref = new URL(path, href)
                    const attrs = node.getAttributeNames()
                    attrs
                        .filter(key => ~['src', 'href'].indexOf(key))
                        .forEach(key => {
                            const newHref = new URL(str, relationHref).href
                            if (node.getAttribute(key) !== newHref) {
                                node.setAttribute(key, newHref)
                            }
                        })
                }
            })
        }
        return new URL(str, href()).href
    }
    function isHideComment(node) {
        if (!node) {
            return false
        }
        return node.nodeType === Node.COMMENT_NODE && node.textContent === 'hidden'
    }
    function isExistingNode(node) {
        return node.ownerDocument && !!node.ownerDocument.contains(node)
    }
    async function getRawScriptContent(src) {
        if (!src) {
            return false
        }
        if (src.length > 500) {
            return false
        }
        const fullSrc = completeAttrHref(src)
        if (isValidUrl(fullSrc)) {
            try {
                return await getScript(fullSrc)
            } catch (err) {
                return false
            }
        }
        return false
    }
    function isValidUrl(url) {
        try {
            new URL(url)
        } catch (_) {
            return false
        }
        return true
    }
    async function getScript(src) {
        return await fetch(src).then(async res => filteringScriptTag(await res.text()))
    }

    function disableScrolling(target) {
        const keys = { 37: 1, 38: 1, 39: 1, 40: 1 }
        function preventDefault(e) {
            e.preventDefault()
        }
        function preventDefaultForScrollKeys(e) {
            if (keys[e.keyCode]) {
                preventDefault(e)
                return false
            }
        }
        let supportsPassive = false
        try {
            target.addEventListener(
                'test',
                () => {},
                Object.defineProperty({}, 'passive', {
                    get: function () {
                        supportsPassive = true
                    }
                })
            )
        } catch (e) {}
        const wheelOpt = supportsPassive ? { passive: false } : false
        const wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel'
        function disableScroll() {
            target.addEventListener('DOMMouseScroll', preventDefault, false)
            target.addEventListener(wheelEvent, preventDefault, wheelOpt)
            target.addEventListener('touchmove', preventDefault, wheelOpt)
            target.addEventListener('keydown', preventDefaultForScrollKeys, false)
        }
        disableScroll()
    }

    const TPL = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0,user-scalable=no, viewport-fit=cover">
    <meta http-equiv="Content-Security-Policy-Report-Only" />
    <title>TimeCat</title>
</head>
<body>
</body>
</html>
`
    const pacmanCss = `.pacman-box{margin:0 auto;display:flex;vertical-align:middle;height:100vh;flex:0 1 auto;flex-direction:column;flex-grow:1;flex-shrink:0;flex-basis:25%;max-width:25%;align-items:center;justify-content:center}.pacman>div:first-of-type,.pacman>div:nth-child(2){width:0;height:0;border-right:25px solid transparent;border-top:25px solid grey;border-left:25px solid grey;border-bottom:25px solid grey;border-radius:25px;position:relative;left:-30px}@-webkit-keyframes rotate_pacman_half_up{0%,100%{-webkit-transform:rotate(270deg);transform:rotate(270deg)}50%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes rotate_pacman_half_up{0%,100%{-webkit-transform:rotate(270deg);transform:rotate(270deg)}50%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-webkit-keyframes rotate_pacman_half_down{0%,100%{-webkit-transform:rotate(90deg);transform:rotate(90deg)}50%{-webkit-transform:rotate(0);transform:rotate(0)}}@keyframes rotate_pacman_half_down{0%,100%{-webkit-transform:rotate(90deg);transform:rotate(90deg)}50%{-webkit-transform:rotate(0);transform:rotate(0)}}@-webkit-keyframes pacman-balls{75%{opacity:.7}100%{-webkit-transform:translate(-100px,-6.25px);transform:translate(-100px,-6.25px)}}@keyframes pacman-balls{75%{opacity:.7}100%{-webkit-transform:translate(-100px,-6.25px);transform:translate(-100px,-6.25px)}}.pacman{transform: translateX(30px);position:relative}.pacman>div:nth-child(3){-webkit-animation:pacman-balls 1s -.66s infinite linear;animation:pacman-balls 1s -.66s infinite linear}.pacman>div:nth-child(4){-webkit-animation:pacman-balls 1s -.33s infinite linear;animation:pacman-balls 1s -.33s infinite linear}.pacman>div:nth-child(5){-webkit-animation:pacman-balls 1s 0s infinite linear;animation:pacman-balls 1s 0s infinite linear}.pacman>div:first-of-type{-webkit-animation:rotate_pacman_half_up .5s 0s infinite;animation:rotate_pacman_half_up .5s 0s infinite}.pacman>div:nth-child(2){-webkit-animation:rotate_pacman_half_down .5s 0s infinite;animation:rotate_pacman_half_down .5s 0s infinite;margin-top:-50px}.pacman>div:nth-child(3),.pacman>div:nth-child(4),.pacman>div:nth-child(5),.pacman>div:nth-child(6){background-color:grey;border-radius:100%;margin:2px;width:10px;height:10px;position:absolute;-webkit-transform:translate(0,-6.25px);transform:translate(0,-6.25px);top:25px;left:70px}`

    var common = createCommonjsModule(function (module, exports) {
        var TYPED_OK =
            typeof Uint8Array !== 'undefined' && typeof Uint16Array !== 'undefined' && typeof Int32Array !== 'undefined'

        function _has(obj, key) {
            return Object.prototype.hasOwnProperty.call(obj, key)
        }

        exports.assign = function (obj /*from1, from2, from3, ...*/) {
            var sources = Array.prototype.slice.call(arguments, 1)
            while (sources.length) {
                var source = sources.shift()
                if (!source) {
                    continue
                }

                if (typeof source !== 'object') {
                    throw new TypeError(source + 'must be non-object')
                }

                for (var p in source) {
                    if (_has(source, p)) {
                        obj[p] = source[p]
                    }
                }
            }

            return obj
        }

        // reduce buffer size, avoiding mem copy
        exports.shrinkBuf = function (buf, size) {
            if (buf.length === size) {
                return buf
            }
            if (buf.subarray) {
                return buf.subarray(0, size)
            }
            buf.length = size
            return buf
        }

        var fnTyped = {
            arraySet: function (dest, src, src_offs, len, dest_offs) {
                if (src.subarray && dest.subarray) {
                    dest.set(src.subarray(src_offs, src_offs + len), dest_offs)
                    return
                }
                // Fallback to ordinary array
                for (var i = 0; i < len; i++) {
                    dest[dest_offs + i] = src[src_offs + i]
                }
            },
            // Join array of chunks to single array.
            flattenChunks: function (chunks) {
                var i, l, len, pos, chunk, result

                // calculate data length
                len = 0
                for (i = 0, l = chunks.length; i < l; i++) {
                    len += chunks[i].length
                }

                // join chunks
                result = new Uint8Array(len)
                pos = 0
                for (i = 0, l = chunks.length; i < l; i++) {
                    chunk = chunks[i]
                    result.set(chunk, pos)
                    pos += chunk.length
                }

                return result
            }
        }

        var fnUntyped = {
            arraySet: function (dest, src, src_offs, len, dest_offs) {
                for (var i = 0; i < len; i++) {
                    dest[dest_offs + i] = src[src_offs + i]
                }
            },
            // Join array of chunks to single array.
            flattenChunks: function (chunks) {
                return [].concat.apply([], chunks)
            }
        }

        // Enable/Disable typed arrays use, for testing
        //
        exports.setTyped = function (on) {
            if (on) {
                exports.Buf8 = Uint8Array
                exports.Buf16 = Uint16Array
                exports.Buf32 = Int32Array
                exports.assign(exports, fnTyped)
            } else {
                exports.Buf8 = Array
                exports.Buf16 = Array
                exports.Buf32 = Array
                exports.assign(exports, fnUntyped)
            }
        }

        exports.setTyped(TYPED_OK)
    })
    var common_1 = common.assign
    var common_2 = common.shrinkBuf
    var common_3 = common.setTyped
    var common_4 = common.Buf8
    var common_5 = common.Buf16
    var common_6 = common.Buf32

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    /* eslint-disable space-unary-ops */

    /* Public constants ==========================================================*/
    /* ===========================================================================*/

    //var Z_FILTERED          = 1;
    //var Z_HUFFMAN_ONLY      = 2;
    //var Z_RLE               = 3;
    var Z_FIXED = 4
    //var Z_DEFAULT_STRATEGY  = 0;

    /* Possible values of the data_type field (though see inflate()) */
    var Z_BINARY = 0
    var Z_TEXT = 1
    //var Z_ASCII             = 1; // = Z_TEXT
    var Z_UNKNOWN = 2

    /*============================================================================*/

    function zero(buf) {
        var len = buf.length
        while (--len >= 0) {
            buf[len] = 0
        }
    }

    // From zutil.h

    var STORED_BLOCK = 0
    var STATIC_TREES = 1
    var DYN_TREES = 2
    /* The three kinds of block type */

    var MIN_MATCH = 3
    var MAX_MATCH = 258
    /* The minimum and maximum match lengths */

    // From deflate.h
    /* ===========================================================================
     * Internal compression state.
     */

    var LENGTH_CODES = 29
    /* number of length codes, not counting the special END_BLOCK code */

    var LITERALS = 256
    /* number of literal bytes 0..255 */

    var L_CODES = LITERALS + 1 + LENGTH_CODES
    /* number of Literal or Length codes, including the END_BLOCK code */

    var D_CODES = 30
    /* number of distance codes */

    var BL_CODES = 19
    /* number of codes used to transfer the bit lengths */

    var HEAP_SIZE = 2 * L_CODES + 1
    /* maximum heap size */

    var MAX_BITS = 15
    /* All codes must not exceed MAX_BITS bits */

    var Buf_size = 16
    /* size of bit buffer in bi_buf */

    /* ===========================================================================
     * Constants
     */

    var MAX_BL_BITS = 7
    /* Bit length codes must not exceed MAX_BL_BITS bits */

    var END_BLOCK = 256
    /* end of block literal code */

    var REP_3_6 = 16
    /* repeat previous bit length 3-6 times (2 bits of repeat count) */

    var REPZ_3_10 = 17
    /* repeat a zero length 3-10 times  (3 bits of repeat count) */

    var REPZ_11_138 = 18
    /* repeat a zero length 11-138 times  (7 bits of repeat count) */

    /* eslint-disable comma-spacing,array-bracket-spacing */
    var extra_lbits =
        /* extra bits for each length code */
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]

    var extra_dbits =
        /* extra bits for each distance code */
        [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]

    var extra_blbits =
        /* extra bits for each bit length code */
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]

    var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
    /* eslint-enable comma-spacing,array-bracket-spacing */

    /* The lengths of the bit length codes are sent in order of decreasing
     * probability, to avoid transmitting the lengths for unused bit length codes.
     */

    /* ===========================================================================
     * Local data. These are initialized only once.
     */

    // We pre-fill arrays with 0 to avoid uninitialized gaps

    var DIST_CODE_LEN = 512 /* see definition of array dist_code below */

    // !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
    var static_ltree = new Array((L_CODES + 2) * 2)
    zero(static_ltree)
    /* The static literal tree. Since the bit lengths are imposed, there is no
     * need for the L_CODES extra codes used during heap construction. However
     * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
     * below).
     */

    var static_dtree = new Array(D_CODES * 2)
    zero(static_dtree)
    /* The static distance tree. (Actually a trivial tree since all codes use
     * 5 bits.)
     */

    var _dist_code = new Array(DIST_CODE_LEN)
    zero(_dist_code)
    /* Distance codes. The first 256 values correspond to the distances
     * 3 .. 258, the last 256 values correspond to the top 8 bits of
     * the 15 bit distances.
     */

    var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1)
    zero(_length_code)
    /* length code for each normalized match length (0 == MIN_MATCH) */

    var base_length = new Array(LENGTH_CODES)
    zero(base_length)
    /* First normalized length for each code (0 = MIN_MATCH) */

    var base_dist = new Array(D_CODES)
    zero(base_dist)
    /* First normalized distance for each code (0 = distance of 1) */

    function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
        this.static_tree = static_tree /* static tree or NULL */
        this.extra_bits = extra_bits /* extra bits for each code or NULL */
        this.extra_base = extra_base /* base index for extra_bits */
        this.elems = elems /* max number of elements in the tree */
        this.max_length = max_length /* max bit length for the codes */

        // show if `static_tree` has data or dummy - needed for monomorphic objects
        this.has_stree = static_tree && static_tree.length
    }

    var static_l_desc
    var static_d_desc
    var static_bl_desc

    function TreeDesc(dyn_tree, stat_desc) {
        this.dyn_tree = dyn_tree /* the dynamic tree */
        this.max_code = 0 /* largest code with non zero frequency */
        this.stat_desc = stat_desc /* the corresponding static tree */
    }

    function d_code(dist) {
        return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)]
    }

    /* ===========================================================================
     * Output a short LSB first on the stream.
     * IN assertion: there is enough room in pendingBuf.
     */
    function put_short(s, w) {
        //    put_byte(s, (uch)((w) & 0xff));
        //    put_byte(s, (uch)((ush)(w) >> 8));
        s.pending_buf[s.pending++] = w & 0xff
        s.pending_buf[s.pending++] = (w >>> 8) & 0xff
    }

    /* ===========================================================================
     * Send a value on a given number of bits.
     * IN assertion: length <= 16 and value fits in length bits.
     */
    function send_bits(s, value, length) {
        if (s.bi_valid > Buf_size - length) {
            s.bi_buf |= (value << s.bi_valid) & 0xffff
            put_short(s, s.bi_buf)
            s.bi_buf = value >> (Buf_size - s.bi_valid)
            s.bi_valid += length - Buf_size
        } else {
            s.bi_buf |= (value << s.bi_valid) & 0xffff
            s.bi_valid += length
        }
    }

    function send_code(s, c, tree) {
        send_bits(s, tree[c * 2] /*.Code*/, tree[c * 2 + 1] /*.Len*/)
    }

    /* ===========================================================================
     * Reverse the first len bits of a code, using straightforward code (a faster
     * method would use a table)
     * IN assertion: 1 <= len <= 15
     */
    function bi_reverse(code, len) {
        var res = 0
        do {
            res |= code & 1
            code >>>= 1
            res <<= 1
        } while (--len > 0)
        return res >>> 1
    }

    /* ===========================================================================
     * Flush the bit buffer, keeping at most 7 bits in it.
     */
    function bi_flush(s) {
        if (s.bi_valid === 16) {
            put_short(s, s.bi_buf)
            s.bi_buf = 0
            s.bi_valid = 0
        } else if (s.bi_valid >= 8) {
            s.pending_buf[s.pending++] = s.bi_buf & 0xff
            s.bi_buf >>= 8
            s.bi_valid -= 8
        }
    }

    /* ===========================================================================
     * Compute the optimal bit lengths for a tree and update the total bit length
     * for the current block.
     * IN assertion: the fields freq and dad are set, heap[heap_max] and
     *    above are the tree nodes sorted by increasing frequency.
     * OUT assertions: the field len is set to the optimal bit length, the
     *     array bl_count contains the frequencies for each bit length.
     *     The length opt_len is updated; static_len is also updated if stree is
     *     not null.
     */
    function gen_bitlen(s, desc) {
        //    deflate_state *s;
        //    tree_desc *desc;    /* the tree descriptor */
        var tree = desc.dyn_tree
        var max_code = desc.max_code
        var stree = desc.stat_desc.static_tree
        var has_stree = desc.stat_desc.has_stree
        var extra = desc.stat_desc.extra_bits
        var base = desc.stat_desc.extra_base
        var max_length = desc.stat_desc.max_length
        var h /* heap index */
        var n, m /* iterate over the tree elements */
        var bits /* bit length */
        var xbits /* extra bits */
        var f /* frequency */
        var overflow = 0 /* number of elements with bit length too large */

        for (bits = 0; bits <= MAX_BITS; bits++) {
            s.bl_count[bits] = 0
        }

        /* In a first pass, compute the optimal bit lengths (which may
         * overflow in the case of the bit length tree).
         */
        tree[s.heap[s.heap_max] * 2 + 1] /*.Len*/ = 0 /* root of the heap */

        for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
            n = s.heap[h]
            bits = tree[tree[n * 2 + 1] /*.Dad*/ * 2 + 1] /*.Len*/ + 1
            if (bits > max_length) {
                bits = max_length
                overflow++
            }
            tree[n * 2 + 1] /*.Len*/ = bits
            /* We overwrite tree[n].Dad which is no longer needed */

            if (n > max_code) {
                continue
            } /* not a leaf node */

            s.bl_count[bits]++
            xbits = 0
            if (n >= base) {
                xbits = extra[n - base]
            }
            f = tree[n * 2] /*.Freq*/
            s.opt_len += f * (bits + xbits)
            if (has_stree) {
                s.static_len += f * (stree[n * 2 + 1] /*.Len*/ + xbits)
            }
        }
        if (overflow === 0) {
            return
        }

        // Trace((stderr,"\nbit length overflow\n"));
        /* This happens for example on obj2 and pic of the Calgary corpus */

        /* Find the first bit length which could increase: */
        do {
            bits = max_length - 1
            while (s.bl_count[bits] === 0) {
                bits--
            }
            s.bl_count[bits]-- /* move one leaf down the tree */
            s.bl_count[bits + 1] += 2 /* move one overflow item as its brother */
            s.bl_count[max_length]--
            /* The brother of the overflow item also moves one step up,
             * but this does not affect bl_count[max_length]
             */
            overflow -= 2
        } while (overflow > 0)

        /* Now recompute all bit lengths, scanning in increasing frequency.
         * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
         * lengths instead of fixing only the wrong ones. This idea is taken
         * from 'ar' written by Haruhiko Okumura.)
         */
        for (bits = max_length; bits !== 0; bits--) {
            n = s.bl_count[bits]
            while (n !== 0) {
                m = s.heap[--h]
                if (m > max_code) {
                    continue
                }
                if (tree[m * 2 + 1] /*.Len*/ !== bits) {
                    // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
                    s.opt_len += (bits - tree[m * 2 + 1]) /*.Len*/ * tree[m * 2] /*.Freq*/
                    tree[m * 2 + 1] /*.Len*/ = bits
                }
                n--
            }
        }
    }

    /* ===========================================================================
     * Generate the codes for a given tree and bit counts (which need not be
     * optimal).
     * IN assertion: the array bl_count contains the bit length statistics for
     * the given tree and the field len is set for all tree elements.
     * OUT assertion: the field code is set for all tree elements of non
     *     zero code length.
     */
    function gen_codes(tree, max_code, bl_count) {
        //    ct_data *tree;             /* the tree to decorate */
        //    int max_code;              /* largest code with non zero frequency */
        //    ushf *bl_count;            /* number of codes at each bit length */
        var next_code = new Array(MAX_BITS + 1) /* next code value for each bit length */
        var code = 0 /* running code value */
        var bits /* bit index */
        var n /* code index */

        /* The distribution counts are first used to generate the code values
         * without bit reversal.
         */
        for (bits = 1; bits <= MAX_BITS; bits++) {
            next_code[bits] = code = (code + bl_count[bits - 1]) << 1
        }
        /* Check that the bit counts in bl_count are consistent. The last code
         * must be all ones.
         */
        //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
        //        "inconsistent bit counts");
        //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

        for (n = 0; n <= max_code; n++) {
            var len = tree[n * 2 + 1] /*.Len*/
            if (len === 0) {
                continue
            }
            /* Now reverse the bits */
            tree[n * 2] /*.Code*/ = bi_reverse(next_code[len]++, len)

            //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
            //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
        }
    }

    /* ===========================================================================
     * Initialize the various 'constant' tables.
     */
    function tr_static_init() {
        var n /* iterates over tree elements */
        var bits /* bit counter */
        var length /* length value */
        var code /* code value */
        var dist /* distance index */
        var bl_count = new Array(MAX_BITS + 1)
        /* number of codes at each bit length for an optimal tree */

        // do check in _tr_init()
        //if (static_init_done) return;

        /* For some embedded targets, global variables are not initialized: */
        /*#ifdef NO_INIT_GLOBAL_POINTERS
      static_l_desc.static_tree = static_ltree;
      static_l_desc.extra_bits = extra_lbits;
      static_d_desc.static_tree = static_dtree;
      static_d_desc.extra_bits = extra_dbits;
      static_bl_desc.extra_bits = extra_blbits;
    #endif*/

        /* Initialize the mapping length (0..255) -> length code (0..28) */
        length = 0
        for (code = 0; code < LENGTH_CODES - 1; code++) {
            base_length[code] = length
            for (n = 0; n < 1 << extra_lbits[code]; n++) {
                _length_code[length++] = code
            }
        }
        //Assert (length == 256, "tr_static_init: length != 256");
        /* Note that the length 255 (match length 258) can be represented
         * in two different ways: code 284 + 5 bits or code 285, so we
         * overwrite length_code[255] to use the best encoding:
         */
        _length_code[length - 1] = code

        /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
        dist = 0
        for (code = 0; code < 16; code++) {
            base_dist[code] = dist
            for (n = 0; n < 1 << extra_dbits[code]; n++) {
                _dist_code[dist++] = code
            }
        }
        //Assert (dist == 256, "tr_static_init: dist != 256");
        dist >>= 7 /* from now on, all distances are divided by 128 */
        for (; code < D_CODES; code++) {
            base_dist[code] = dist << 7
            for (n = 0; n < 1 << (extra_dbits[code] - 7); n++) {
                _dist_code[256 + dist++] = code
            }
        }
        //Assert (dist == 256, "tr_static_init: 256+dist != 512");

        /* Construct the codes of the static literal tree */
        for (bits = 0; bits <= MAX_BITS; bits++) {
            bl_count[bits] = 0
        }

        n = 0
        while (n <= 143) {
            static_ltree[n * 2 + 1] /*.Len*/ = 8
            n++
            bl_count[8]++
        }
        while (n <= 255) {
            static_ltree[n * 2 + 1] /*.Len*/ = 9
            n++
            bl_count[9]++
        }
        while (n <= 279) {
            static_ltree[n * 2 + 1] /*.Len*/ = 7
            n++
            bl_count[7]++
        }
        while (n <= 287) {
            static_ltree[n * 2 + 1] /*.Len*/ = 8
            n++
            bl_count[8]++
        }
        /* Codes 286 and 287 do not exist, but we must include them in the
         * tree construction to get a canonical Huffman tree (longest code
         * all ones)
         */
        gen_codes(static_ltree, L_CODES + 1, bl_count)

        /* The static distance tree is trivial: */
        for (n = 0; n < D_CODES; n++) {
            static_dtree[n * 2 + 1] /*.Len*/ = 5
            static_dtree[n * 2] /*.Code*/ = bi_reverse(n, 5)
        }

        // Now data ready and we can init static trees
        static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS)
        static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS)
        static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS)

        //static_init_done = true;
    }

    /* ===========================================================================
     * Initialize a new block.
     */
    function init_block(s) {
        var n /* iterates over tree elements */

        /* Initialize the trees. */
        for (n = 0; n < L_CODES; n++) {
            s.dyn_ltree[n * 2] /*.Freq*/ = 0
        }
        for (n = 0; n < D_CODES; n++) {
            s.dyn_dtree[n * 2] /*.Freq*/ = 0
        }
        for (n = 0; n < BL_CODES; n++) {
            s.bl_tree[n * 2] /*.Freq*/ = 0
        }

        s.dyn_ltree[END_BLOCK * 2] /*.Freq*/ = 1
        s.opt_len = s.static_len = 0
        s.last_lit = s.matches = 0
    }

    /* ===========================================================================
     * Flush the bit buffer and align the output on a byte boundary
     */
    function bi_windup(s) {
        if (s.bi_valid > 8) {
            put_short(s, s.bi_buf)
        } else if (s.bi_valid > 0) {
            //put_byte(s, (Byte)s->bi_buf);
            s.pending_buf[s.pending++] = s.bi_buf
        }
        s.bi_buf = 0
        s.bi_valid = 0
    }

    /* ===========================================================================
     * Copy a stored block, storing first the length and its
     * one's complement if requested.
     */
    function copy_block(s, buf, len, header) {
        //DeflateState *s;
        //charf    *buf;    /* the input data */
        //unsigned len;     /* its length */
        //int      header;  /* true if block header must be written */
        bi_windup(s) /* align on byte boundary */

        if (header) {
            put_short(s, len)
            put_short(s, ~len)
        }
        //  while (len--) {
        //    put_byte(s, *buf++);
        //  }
        common.arraySet(s.pending_buf, s.window, buf, len, s.pending)
        s.pending += len
    }

    /* ===========================================================================
     * Compares to subtrees, using the tree depth as tie breaker when
     * the subtrees have equal frequency. This minimizes the worst case length.
     */
    function smaller(tree, n, m, depth) {
        var _n2 = n * 2
        var _m2 = m * 2
        return (
            tree[_n2] /*.Freq*/ < tree[_m2] /*.Freq*/ ||
            (tree[_n2] /*.Freq*/ === tree[_m2] /*.Freq*/ && depth[n] <= depth[m])
        )
    }

    /* ===========================================================================
     * Restore the heap property by moving down the tree starting at node k,
     * exchanging a node with the smallest of its two sons if necessary, stopping
     * when the heap property is re-established (each father smaller than its
     * two sons).
     */
    function pqdownheap(s, tree, k) {
        //    deflate_state *s;
        //    ct_data *tree;  /* the tree to restore */
        //    int k;               /* node to move down */
        var v = s.heap[k]
        var j = k << 1 /* left son of k */
        while (j <= s.heap_len) {
            /* Set j to the smallest of the two sons: */
            if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
                j++
            }
            /* Exit if v is smaller than both sons */
            if (smaller(tree, v, s.heap[j], s.depth)) {
                break
            }

            /* Exchange v with the smallest son */
            s.heap[k] = s.heap[j]
            k = j

            /* And continue down the tree, setting j to the left son of k */
            j <<= 1
        }
        s.heap[k] = v
    }

    // inlined manually
    // var SMALLEST = 1;

    /* ===========================================================================
     * Send the block data compressed using the given Huffman trees
     */
    function compress_block(s, ltree, dtree) {
        //    deflate_state *s;
        //    const ct_data *ltree; /* literal tree */
        //    const ct_data *dtree; /* distance tree */
        var dist /* distance of matched string */
        var lc /* match length or unmatched char (if dist == 0) */
        var lx = 0 /* running index in l_buf */
        var code /* the code to send */
        var extra /* number of extra bits to send */

        if (s.last_lit !== 0) {
            do {
                dist = (s.pending_buf[s.d_buf + lx * 2] << 8) | s.pending_buf[s.d_buf + lx * 2 + 1]
                lc = s.pending_buf[s.l_buf + lx]
                lx++

                if (dist === 0) {
                    send_code(s, lc, ltree) /* send a literal byte */
                    //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
                } else {
                    /* Here, lc is the match length - MIN_MATCH */
                    code = _length_code[lc]
                    send_code(s, code + LITERALS + 1, ltree) /* send the length code */
                    extra = extra_lbits[code]
                    if (extra !== 0) {
                        lc -= base_length[code]
                        send_bits(s, lc, extra) /* send the extra length bits */
                    }
                    dist-- /* dist is now the match distance - 1 */
                    code = d_code(dist)
                    //Assert (code < D_CODES, "bad d_code");

                    send_code(s, code, dtree) /* send the distance code */
                    extra = extra_dbits[code]
                    if (extra !== 0) {
                        dist -= base_dist[code]
                        send_bits(s, dist, extra) /* send the extra distance bits */
                    }
                } /* literal or match pair ? */

                /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
                //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
                //       "pendingBuf overflow");
            } while (lx < s.last_lit)
        }

        send_code(s, END_BLOCK, ltree)
    }

    /* ===========================================================================
     * Construct one Huffman tree and assigns the code bit strings and lengths.
     * Update the total bit length for the current block.
     * IN assertion: the field freq is set for all tree elements.
     * OUT assertions: the fields len and code are set to the optimal bit length
     *     and corresponding code. The length opt_len is updated; static_len is
     *     also updated if stree is not null. The field max_code is set.
     */
    function build_tree(s, desc) {
        //    deflate_state *s;
        //    tree_desc *desc; /* the tree descriptor */
        var tree = desc.dyn_tree
        var stree = desc.stat_desc.static_tree
        var has_stree = desc.stat_desc.has_stree
        var elems = desc.stat_desc.elems
        var n, m /* iterate over heap elements */
        var max_code = -1 /* largest code with non zero frequency */
        var node /* new node being created */

        /* Construct the initial heap, with least frequent element in
         * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
         * heap[0] is not used.
         */
        s.heap_len = 0
        s.heap_max = HEAP_SIZE

        for (n = 0; n < elems; n++) {
            if (tree[n * 2] /*.Freq*/ !== 0) {
                s.heap[++s.heap_len] = max_code = n
                s.depth[n] = 0
            } else {
                tree[n * 2 + 1] /*.Len*/ = 0
            }
        }

        /* The pkzip format requires that at least one distance code exists,
         * and that at least one bit should be sent even if there is only one
         * possible code. So to avoid special checks later on we force at least
         * two codes of non zero frequency.
         */
        while (s.heap_len < 2) {
            node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0
            tree[node * 2] /*.Freq*/ = 1
            s.depth[node] = 0
            s.opt_len--

            if (has_stree) {
                s.static_len -= stree[node * 2 + 1] /*.Len*/
            }
            /* node is 0 or 1 so it does not have extra bits */
        }
        desc.max_code = max_code

        /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
         * establish sub-heaps of increasing lengths:
         */
        for (n = s.heap_len >> 1 /*int /2*/; n >= 1; n--) {
            pqdownheap(s, tree, n)
        }

        /* Construct the Huffman tree by repeatedly combining the least two
         * frequent nodes.
         */
        node = elems /* next internal node of the tree */
        do {
            //pqremove(s, tree, n);  /* n = node of least frequency */
            /*** pqremove ***/
            n = s.heap[1 /*SMALLEST*/]
            s.heap[1 /*SMALLEST*/] = s.heap[s.heap_len--]
            pqdownheap(s, tree, 1 /*SMALLEST*/)
            /***/

            m = s.heap[1 /*SMALLEST*/] /* m = node of next least frequency */

            s.heap[--s.heap_max] = n /* keep the nodes sorted by frequency */
            s.heap[--s.heap_max] = m

            /* Create a new node father of n and m */
            tree[node * 2] /*.Freq*/ = tree[n * 2] /*.Freq*/ + tree[m * 2] /*.Freq*/
            s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1
            tree[n * 2 + 1] /*.Dad*/ = tree[m * 2 + 1] /*.Dad*/ = node

            /* and insert the new node in the heap */
            s.heap[1 /*SMALLEST*/] = node++
            pqdownheap(s, tree, 1 /*SMALLEST*/)
        } while (s.heap_len >= 2)

        s.heap[--s.heap_max] = s.heap[1 /*SMALLEST*/]

        /* At this point, the fields freq and dad are set. We can now
         * generate the bit lengths.
         */
        gen_bitlen(s, desc)

        /* The field len is now set, we can generate the bit codes */
        gen_codes(tree, max_code, s.bl_count)
    }

    /* ===========================================================================
     * Scan a literal or distance tree to determine the frequencies of the codes
     * in the bit length tree.
     */
    function scan_tree(s, tree, max_code) {
        //    deflate_state *s;
        //    ct_data *tree;   /* the tree to be scanned */
        //    int max_code;    /* and its largest code of non zero frequency */
        var n /* iterates over all tree elements */
        var prevlen = -1 /* last emitted length */
        var curlen /* length of current code */

        var nextlen = tree[0 * 2 + 1] /* length of next code */ /*.Len*/

        var count = 0 /* repeat count of the current code */
        var max_count = 7 /* max repeat count */
        var min_count = 4 /* min repeat count */

        if (nextlen === 0) {
            max_count = 138
            min_count = 3
        }
        tree[(max_code + 1) * 2 + 1] /*.Len*/ = 0xffff /* guard */

        for (n = 0; n <= max_code; n++) {
            curlen = nextlen
            nextlen = tree[(n + 1) * 2 + 1] /*.Len*/

            if (++count < max_count && curlen === nextlen) {
                continue
            } else if (count < min_count) {
                s.bl_tree[curlen * 2] /*.Freq*/ += count
            } else if (curlen !== 0) {
                if (curlen !== prevlen) {
                    s.bl_tree[curlen * 2] /*.Freq*/++
                }
                s.bl_tree[REP_3_6 * 2] /*.Freq*/++
            } else if (count <= 10) {
                s.bl_tree[REPZ_3_10 * 2] /*.Freq*/++
            } else {
                s.bl_tree[REPZ_11_138 * 2] /*.Freq*/++
            }

            count = 0
            prevlen = curlen

            if (nextlen === 0) {
                max_count = 138
                min_count = 3
            } else if (curlen === nextlen) {
                max_count = 6
                min_count = 3
            } else {
                max_count = 7
                min_count = 4
            }
        }
    }

    /* ===========================================================================
     * Send a literal or distance tree in compressed form, using the codes in
     * bl_tree.
     */
    function send_tree(s, tree, max_code) {
        //    deflate_state *s;
        //    ct_data *tree; /* the tree to be scanned */
        //    int max_code;       /* and its largest code of non zero frequency */
        var n /* iterates over all tree elements */
        var prevlen = -1 /* last emitted length */
        var curlen /* length of current code */

        var nextlen = tree[0 * 2 + 1] /* length of next code */ /*.Len*/

        var count = 0 /* repeat count of the current code */
        var max_count = 7 /* max repeat count */
        var min_count = 4 /* min repeat count */ /* guard already set */

        /* tree[max_code+1].Len = -1; */ if (nextlen === 0) {
            max_count = 138
            min_count = 3
        }

        for (n = 0; n <= max_code; n++) {
            curlen = nextlen
            nextlen = tree[(n + 1) * 2 + 1] /*.Len*/

            if (++count < max_count && curlen === nextlen) {
                continue
            } else if (count < min_count) {
                do {
                    send_code(s, curlen, s.bl_tree)
                } while (--count !== 0)
            } else if (curlen !== 0) {
                if (curlen !== prevlen) {
                    send_code(s, curlen, s.bl_tree)
                    count--
                }
                //Assert(count >= 3 && count <= 6, " 3_6?");
                send_code(s, REP_3_6, s.bl_tree)
                send_bits(s, count - 3, 2)
            } else if (count <= 10) {
                send_code(s, REPZ_3_10, s.bl_tree)
                send_bits(s, count - 3, 3)
            } else {
                send_code(s, REPZ_11_138, s.bl_tree)
                send_bits(s, count - 11, 7)
            }

            count = 0
            prevlen = curlen
            if (nextlen === 0) {
                max_count = 138
                min_count = 3
            } else if (curlen === nextlen) {
                max_count = 6
                min_count = 3
            } else {
                max_count = 7
                min_count = 4
            }
        }
    }

    /* ===========================================================================
     * Construct the Huffman tree for the bit lengths and return the index in
     * bl_order of the last bit length code to send.
     */
    function build_bl_tree(s) {
        var max_blindex /* index of last bit length code of non zero freq */

        /* Determine the bit length frequencies for literal and distance trees */
        scan_tree(s, s.dyn_ltree, s.l_desc.max_code)
        scan_tree(s, s.dyn_dtree, s.d_desc.max_code)

        /* Build the bit length tree: */
        build_tree(s, s.bl_desc)
        /* opt_len now includes the length of the tree representations, except
         * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
         */

        /* Determine the number of bit length codes to send. The pkzip format
         * requires that at least 4 bit length codes be sent. (appnote.txt says
         * 3 but the actual value used is 4.)
         */
        for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
            if (s.bl_tree[bl_order[max_blindex] * 2 + 1] /*.Len*/ !== 0) {
                break
            }
        }
        /* Update opt_len to include the bit length tree and counts */
        s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4
        //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
        //        s->opt_len, s->static_len));

        return max_blindex
    }

    /* ===========================================================================
     * Send the header for a block using dynamic Huffman trees: the counts, the
     * lengths of the bit length codes, the literal tree and the distance tree.
     * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
     */
    function send_all_trees(s, lcodes, dcodes, blcodes) {
        //    deflate_state *s;
        //    int lcodes, dcodes, blcodes; /* number of codes for each tree */
        var rank /* index in bl_order */

        //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
        //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
        //        "too many codes");
        //Tracev((stderr, "\nbl counts: "));
        send_bits(s, lcodes - 257, 5) /* not +255 as stated in appnote.txt */
        send_bits(s, dcodes - 1, 5)
        send_bits(s, blcodes - 4, 4) /* not -3 as stated in appnote.txt */
        for (rank = 0; rank < blcodes; rank++) {
            //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
            send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1] /*.Len*/, 3)
        }
        //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

        send_tree(s, s.dyn_ltree, lcodes - 1) /* literal tree */
        //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

        send_tree(s, s.dyn_dtree, dcodes - 1) /* distance tree */
        //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
    }

    /* ===========================================================================
     * Check if the data type is TEXT or BINARY, using the following algorithm:
     * - TEXT if the two conditions below are satisfied:
     *    a) There are no non-portable control characters belonging to the
     *       "black list" (0..6, 14..25, 28..31).
     *    b) There is at least one printable character belonging to the
     *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
     * - BINARY otherwise.
     * - The following partially-portable control characters form a
     *   "gray list" that is ignored in this detection algorithm:
     *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
     * IN assertion: the fields Freq of dyn_ltree are set.
     */
    function detect_data_type(s) {
        /* black_mask is the bit mask of black-listed bytes
         * set bits 0..6, 14..25, and 28..31
         * 0xf3ffc07f = binary 11110011111111111100000001111111
         */
        var black_mask = 0xf3ffc07f
        var n

        /* Check for non-textual ("black-listed") bytes. */
        for (n = 0; n <= 31; n++, black_mask >>>= 1) {
            if (black_mask & 1 && s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
                return Z_BINARY
            }
        }

        /* Check for textual ("white-listed") bytes. */
        if (
            s.dyn_ltree[9 * 2] /*.Freq*/ !== 0 ||
            s.dyn_ltree[10 * 2] /*.Freq*/ !== 0 ||
            s.dyn_ltree[13 * 2] /*.Freq*/ !== 0
        ) {
            return Z_TEXT
        }
        for (n = 32; n < LITERALS; n++) {
            if (s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
                return Z_TEXT
            }
        }

        /* There are no "black-listed" or "white-listed" bytes:
         * this stream either is empty or has tolerated ("gray-listed") bytes only.
         */
        return Z_BINARY
    }

    var static_init_done = false

    /* ===========================================================================
     * Initialize the tree data structures for a new zlib stream.
     */
    function _tr_init(s) {
        if (!static_init_done) {
            tr_static_init()
            static_init_done = true
        }

        s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc)
        s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc)
        s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc)

        s.bi_buf = 0
        s.bi_valid = 0

        /* Initialize the first block of the first file: */
        init_block(s)
    }

    /* ===========================================================================
     * Send a stored block
     */
    function _tr_stored_block(s, buf, stored_len, last) {
        //DeflateState *s;
        //charf *buf;       /* input block */
        //ulg stored_len;   /* length of input block */
        //int last;         /* one if this is the last block for a file */
        send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3) /* send block type */
        copy_block(s, buf, stored_len, true) /* with header */
    }

    /* ===========================================================================
     * Send one empty static block to give enough lookahead for inflate.
     * This takes 10 bits, of which 7 may remain in the bit buffer.
     */
    function _tr_align(s) {
        send_bits(s, STATIC_TREES << 1, 3)
        send_code(s, END_BLOCK, static_ltree)
        bi_flush(s)
    }

    /* ===========================================================================
     * Determine the best encoding for the current block: dynamic trees, static
     * trees or store, and output the encoded block to the zip file.
     */
    function _tr_flush_block(s, buf, stored_len, last) {
        //DeflateState *s;
        //charf *buf;       /* input block, or NULL if too old */
        //ulg stored_len;   /* length of input block */
        //int last;         /* one if this is the last block for a file */
        var opt_lenb, static_lenb /* opt_len and static_len in bytes */
        var max_blindex = 0 /* index of last bit length code of non zero freq */

        /* Build the Huffman trees unless a stored block is forced */
        if (s.level > 0) {
            /* Check if the file is binary or text */
            if (s.strm.data_type === Z_UNKNOWN) {
                s.strm.data_type = detect_data_type(s)
            }

            /* Construct the literal and distance trees */
            build_tree(s, s.l_desc)
            // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
            //        s->static_len));

            build_tree(s, s.d_desc)
            // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
            //        s->static_len));
            /* At this point, opt_len and static_len are the total bit lengths of
             * the compressed block data, excluding the tree representations.
             */

            /* Build the bit length tree for the above two trees, and get the index
             * in bl_order of the last bit length code to send.
             */
            max_blindex = build_bl_tree(s)

            /* Determine the best encoding. Compute the block lengths in bytes. */
            opt_lenb = (s.opt_len + 3 + 7) >>> 3
            static_lenb = (s.static_len + 3 + 7) >>> 3

            // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
            //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
            //        s->last_lit));

            if (static_lenb <= opt_lenb) {
                opt_lenb = static_lenb
            }
        } else {
            // Assert(buf != (char*)0, "lost buf");
            opt_lenb = static_lenb = stored_len + 5 /* force a stored block */
        }

        if (stored_len + 4 <= opt_lenb && buf !== -1) {
            /* 4: two words for the lengths */

            /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
             * Otherwise we can't have processed more than WSIZE input bytes since
             * the last block flush, because compression would have been
             * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
             * transform a block into a stored block.
             */
            _tr_stored_block(s, buf, stored_len, last)
        } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
            send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3)
            compress_block(s, static_ltree, static_dtree)
        } else {
            send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3)
            send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1)
            compress_block(s, s.dyn_ltree, s.dyn_dtree)
        }
        // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
        /* The above check is made mod 2^32, for files larger than 512 MB
         * and uLong implemented on 32 bits.
         */
        init_block(s)

        if (last) {
            bi_windup(s)
        }
        // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
        //       s->compressed_len-7*last));
    }

    /* ===========================================================================
     * Save the match info and tally the frequency counts. Return true if
     * the current block must be flushed.
     */
    function _tr_tally(s, dist, lc) {
        //    deflate_state *s;
        //    unsigned dist;  /* distance of matched string */
        //    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
        //var out_length, in_length, dcode;

        s.pending_buf[s.d_buf + s.last_lit * 2] = (dist >>> 8) & 0xff
        s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff

        s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff
        s.last_lit++

        if (dist === 0) {
            /* lc is the unmatched char */
            s.dyn_ltree[lc * 2] /*.Freq*/++
        } else {
            s.matches++
            /* Here, lc is the match length - MIN_MATCH */
            dist-- /* dist = match distance - 1 */
            //Assert((ush)dist < (ush)MAX_DIST(s) &&
            //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
            //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

            s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2] /*.Freq*/++
            s.dyn_dtree[d_code(dist) * 2] /*.Freq*/++
        }

        // (!) This block is disabled in zlib defaults,
        // don't enable it for binary compatibility

        //#ifdef TRUNCATE_BLOCK
        //  /* Try to guess if it is profitable to stop the current block here */
        //  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
        //    /* Compute an upper bound for the compressed length */
        //    out_length = s.last_lit*8;
        //    in_length = s.strstart - s.block_start;
        //
        //    for (dcode = 0; dcode < D_CODES; dcode++) {
        //      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
        //    }
        //    out_length >>>= 3;
        //    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
        //    //       s->last_lit, in_length, out_length,
        //    //       100L - out_length*100L/in_length));
        //    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
        //      return true;
        //    }
        //  }
        //#endif

        return s.last_lit === s.lit_bufsize - 1
        /* We avoid equality with lit_bufsize because of wraparound at 64K
         * on 16 bit machines and because stored blocks are restricted to
         * 64K-1 bytes.
         */
    }

    var _tr_init_1 = _tr_init
    var _tr_stored_block_1 = _tr_stored_block
    var _tr_flush_block_1 = _tr_flush_block
    var _tr_tally_1 = _tr_tally
    var _tr_align_1 = _tr_align

    var trees = {
        _tr_init: _tr_init_1,
        _tr_stored_block: _tr_stored_block_1,
        _tr_flush_block: _tr_flush_block_1,
        _tr_tally: _tr_tally_1,
        _tr_align: _tr_align_1
    }

    // Note: adler32 takes 12% for level 0 and 2% for level 6.
    // It isn't worth it to make additional optimizations as in original.
    // Small size is preferable.

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    function adler32(adler, buf, len, pos) {
        var s1 = (adler & 0xffff) | 0,
            s2 = ((adler >>> 16) & 0xffff) | 0,
            n = 0

        while (len !== 0) {
            // Set limit ~ twice less than 5552, to keep
            // s2 in 31-bits, because we force signed ints.
            // in other case %= will fail.
            n = len > 2000 ? 2000 : len
            len -= n

            do {
                s1 = (s1 + buf[pos++]) | 0
                s2 = (s2 + s1) | 0
            } while (--n)

            s1 %= 65521
            s2 %= 65521
        }

        return s1 | (s2 << 16) | 0
    }

    var adler32_1 = adler32

    // Note: we can't get significant speed boost here.
    // So write code to minimize size - no pregenerated tables
    // and array tools dependencies.

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    // Use ordinary array, since untyped makes no boost here
    function makeTable() {
        var c,
            table = []

        for (var n = 0; n < 256; n++) {
            c = n
            for (var k = 0; k < 8; k++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
            }
            table[n] = c
        }

        return table
    }

    // Create table on load. Just 255 signed longs. Not a problem.
    var crcTable = makeTable()

    function crc32(crc, buf, len, pos) {
        var t = crcTable,
            end = pos + len

        crc ^= -1

        for (var i = pos; i < end; i++) {
            crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xff]
        }

        return crc ^ -1 // >>> 0;
    }

    var crc32_1 = crc32

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    var messages = {
        2: 'need dictionary' /* Z_NEED_DICT       2  */,
        1: 'stream end' /* Z_STREAM_END      1  */,
        0: '' /* Z_OK              0  */,
        '-1': 'file error' /* Z_ERRNO         (-1) */,
        '-2': 'stream error' /* Z_STREAM_ERROR  (-2) */,
        '-3': 'data error' /* Z_DATA_ERROR    (-3) */,
        '-4': 'insufficient memory' /* Z_MEM_ERROR     (-4) */,
        '-5': 'buffer error' /* Z_BUF_ERROR     (-5) */,
        '-6': 'incompatible version' /* Z_VERSION_ERROR (-6) */
    }

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    /* Public constants ==========================================================*/
    /* ===========================================================================*/

    /* Allowed flush values; see deflate() and inflate() below for details */
    var Z_NO_FLUSH = 0
    var Z_PARTIAL_FLUSH = 1
    //var Z_SYNC_FLUSH    = 2;
    var Z_FULL_FLUSH = 3
    var Z_FINISH = 4
    var Z_BLOCK = 5
    //var Z_TREES         = 6;

    /* Return codes for the compression/decompression functions. Negative values
     * are errors, positive values are used for special but normal events.
     */
    var Z_OK = 0
    var Z_STREAM_END = 1
    //var Z_NEED_DICT     = 2;
    //var Z_ERRNO         = -1;
    var Z_STREAM_ERROR = -2
    var Z_DATA_ERROR = -3
    //var Z_MEM_ERROR     = -4;
    var Z_BUF_ERROR = -5
    //var Z_VERSION_ERROR = -6;

    /* compression levels */
    //var Z_NO_COMPRESSION      = 0;
    //var Z_BEST_SPEED          = 1;
    //var Z_BEST_COMPRESSION    = 9;
    var Z_DEFAULT_COMPRESSION = -1

    var Z_FILTERED = 1
    var Z_HUFFMAN_ONLY = 2
    var Z_RLE = 3
    var Z_FIXED$1 = 4
    var Z_DEFAULT_STRATEGY = 0

    /* Possible values of the data_type field (though see inflate()) */
    //var Z_BINARY              = 0;
    //var Z_TEXT                = 1;
    //var Z_ASCII               = 1; // = Z_TEXT
    var Z_UNKNOWN$1 = 2

    /* The deflate compression method */
    var Z_DEFLATED = 8

    /*============================================================================*/

    var MAX_MEM_LEVEL = 9
    /* Maximum value for memLevel in deflateInit2 */
    var MAX_WBITS = 15
    /* 32K LZ77 window */
    var DEF_MEM_LEVEL = 8

    var LENGTH_CODES$1 = 29
    /* number of length codes, not counting the special END_BLOCK code */
    var LITERALS$1 = 256
    /* number of literal bytes 0..255 */
    var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1
    /* number of Literal or Length codes, including the END_BLOCK code */
    var D_CODES$1 = 30
    /* number of distance codes */
    var BL_CODES$1 = 19
    /* number of codes used to transfer the bit lengths */
    var HEAP_SIZE$1 = 2 * L_CODES$1 + 1
    /* maximum heap size */
    var MAX_BITS$1 = 15
    /* All codes must not exceed MAX_BITS bits */

    var MIN_MATCH$1 = 3
    var MAX_MATCH$1 = 258
    var MIN_LOOKAHEAD = MAX_MATCH$1 + MIN_MATCH$1 + 1

    var PRESET_DICT = 0x20

    var INIT_STATE = 42
    var EXTRA_STATE = 69
    var NAME_STATE = 73
    var COMMENT_STATE = 91
    var HCRC_STATE = 103
    var BUSY_STATE = 113
    var FINISH_STATE = 666

    var BS_NEED_MORE = 1 /* block not completed, need more input or more output */
    var BS_BLOCK_DONE = 2 /* block flush performed */
    var BS_FINISH_STARTED = 3 /* finish started, need only more output at next deflate */
    var BS_FINISH_DONE = 4 /* finish done, accept no more input or output */

    var OS_CODE = 0x03 // Unix :) . Don't detect, use this default.

    function err(strm, errorCode) {
        strm.msg = messages[errorCode]
        return errorCode
    }

    function rank(f) {
        return (f << 1) - (f > 4 ? 9 : 0)
    }

    function zero$1(buf) {
        var len = buf.length
        while (--len >= 0) {
            buf[len] = 0
        }
    }

    /* =========================================================================
     * Flush as much pending output as possible. All deflate() output goes
     * through this function so some applications may wish to modify it
     * to avoid allocating a large strm->output buffer and copying into it.
     * (See also read_buf()).
     */
    function flush_pending(strm) {
        var s = strm.state

        //_tr_flush_bits(s);
        var len = s.pending
        if (len > strm.avail_out) {
            len = strm.avail_out
        }
        if (len === 0) {
            return
        }

        common.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out)
        strm.next_out += len
        s.pending_out += len
        strm.total_out += len
        strm.avail_out -= len
        s.pending -= len
        if (s.pending === 0) {
            s.pending_out = 0
        }
    }

    function flush_block_only(s, last) {
        trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last)
        s.block_start = s.strstart
        flush_pending(s.strm)
    }

    function put_byte(s, b) {
        s.pending_buf[s.pending++] = b
    }

    /* =========================================================================
     * Put a short in the pending buffer. The 16-bit value is put in MSB order.
     * IN assertion: the stream state is correct and there is enough room in
     * pending_buf.
     */
    function putShortMSB(s, b) {
        //  put_byte(s, (Byte)(b >> 8));
        //  put_byte(s, (Byte)(b & 0xff));
        s.pending_buf[s.pending++] = (b >>> 8) & 0xff
        s.pending_buf[s.pending++] = b & 0xff
    }

    /* ===========================================================================
     * Read a new buffer from the current input stream, update the adler32
     * and total number of bytes read.  All deflate() input goes through
     * this function so some applications may wish to modify it to avoid
     * allocating a large strm->input buffer and copying from it.
     * (See also flush_pending()).
     */
    function read_buf(strm, buf, start, size) {
        var len = strm.avail_in

        if (len > size) {
            len = size
        }
        if (len === 0) {
            return 0
        }

        strm.avail_in -= len

        // zmemcpy(buf, strm->next_in, len);
        common.arraySet(buf, strm.input, strm.next_in, len, start)
        if (strm.state.wrap === 1) {
            strm.adler = adler32_1(strm.adler, buf, len, start)
        } else if (strm.state.wrap === 2) {
            strm.adler = crc32_1(strm.adler, buf, len, start)
        }

        strm.next_in += len
        strm.total_in += len

        return len
    }

    /* ===========================================================================
     * Set match_start to the longest match starting at the given string and
     * return its length. Matches shorter or equal to prev_length are discarded,
     * in which case the result is equal to prev_length and match_start is
     * garbage.
     * IN assertions: cur_match is the head of the hash chain for the current
     *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
     * OUT assertion: the match length is not greater than s->lookahead.
     */
    function longest_match(s, cur_match) {
        var chain_length = s.max_chain_length /* max hash chain length */
        var scan = s.strstart /* current string */
        var match /* matched string */
        var len /* length of current match */
        var best_len = s.prev_length /* best match length so far */
        var nice_match = s.nice_match /* stop if match long enough */
        var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0 /*NIL*/

        var _win = s.window // shortcut

        var wmask = s.w_mask
        var prev = s.prev

        /* Stop when cur_match becomes <= limit. To simplify the code,
         * we prevent matches with the string of window index 0.
         */

        var strend = s.strstart + MAX_MATCH$1
        var scan_end1 = _win[scan + best_len - 1]
        var scan_end = _win[scan + best_len]

        /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
         * It is easy to get rid of this optimization if necessary.
         */
        // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

        /* Do not waste too much time if we already have a good match: */
        if (s.prev_length >= s.good_match) {
            chain_length >>= 2
        }
        /* Do not look for matches beyond the end of the input. This is necessary
         * to make deflate deterministic.
         */
        if (nice_match > s.lookahead) {
            nice_match = s.lookahead
        }

        // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

        do {
            // Assert(cur_match < s->strstart, "no future");
            match = cur_match

            /* Skip to next match if the match length cannot increase
             * or if the match length is less than 2.  Note that the checks below
             * for insufficient lookahead only occur occasionally for performance
             * reasons.  Therefore uninitialized memory will be accessed, and
             * conditional jumps will be made that depend on those values.
             * However the length of the match is limited to the lookahead, so
             * the output of deflate is not affected by the uninitialized values.
             */

            if (
                _win[match + best_len] !== scan_end ||
                _win[match + best_len - 1] !== scan_end1 ||
                _win[match] !== _win[scan] ||
                _win[++match] !== _win[scan + 1]
            ) {
                continue
            }

            /* The check at best_len-1 can be removed because it will be made
             * again later. (This heuristic is not always a win.)
             * It is not necessary to compare scan[2] and match[2] since they
             * are always equal when the other bytes match, given that
             * the hash keys are equal and that HASH_BITS >= 8.
             */
            scan += 2
            match++
            // Assert(*scan == *match, "match[2]?");

            /* We check for insufficient lookahead only every 8th comparison;
             * the 256th check will be made at strstart+258.
             */
            do {
                /*jshint noempty:false*/
            } while (
                _win[++scan] === _win[++match] &&
                _win[++scan] === _win[++match] &&
                _win[++scan] === _win[++match] &&
                _win[++scan] === _win[++match] &&
                _win[++scan] === _win[++match] &&
                _win[++scan] === _win[++match] &&
                _win[++scan] === _win[++match] &&
                _win[++scan] === _win[++match] &&
                scan < strend
            )

            // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

            len = MAX_MATCH$1 - (strend - scan)
            scan = strend - MAX_MATCH$1

            if (len > best_len) {
                s.match_start = cur_match
                best_len = len
                if (len >= nice_match) {
                    break
                }
                scan_end1 = _win[scan + best_len - 1]
                scan_end = _win[scan + best_len]
            }
        } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0)

        if (best_len <= s.lookahead) {
            return best_len
        }
        return s.lookahead
    }

    /* ===========================================================================
     * Fill the window when the lookahead becomes insufficient.
     * Updates strstart and lookahead.
     *
     * IN assertion: lookahead < MIN_LOOKAHEAD
     * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
     *    At least one byte has been read, or avail_in == 0; reads are
     *    performed for at least two bytes (required for the zip translate_eol
     *    option -- not supported here).
     */
    function fill_window(s) {
        var _w_size = s.w_size
        var p, n, m, more, str

        //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

        do {
            more = s.window_size - s.lookahead - s.strstart

            // JS ints have 32 bit, block below not needed
            /* Deal with !@#$% 64K limit: */
            //if (sizeof(int) <= 2) {
            //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
            //        more = wsize;
            //
            //  } else if (more == (unsigned)(-1)) {
            //        /* Very unlikely, but possible on 16 bit machine if
            //         * strstart == 0 && lookahead == 1 (input done a byte at time)
            //         */
            //        more--;
            //    }
            //}

            /* If the window is almost full and there is insufficient lookahead,
             * move the upper half to the lower one to make room in the upper half.
             */
            if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
                common.arraySet(s.window, s.window, _w_size, _w_size, 0)
                s.match_start -= _w_size
                s.strstart -= _w_size
                /* we now have strstart >= MAX_DIST */
                s.block_start -= _w_size

                /* Slide the hash table (could be avoided with 32 bit values
           at the expense of memory usage). We slide even when level == 0
           to keep the hash table consistent if we switch back to level > 0
           later. (Using level 0 permanently is not an optimal usage of
           zlib, so we don't care about this pathological case.)
           */

                n = s.hash_size
                p = n
                do {
                    m = s.head[--p]
                    s.head[p] = m >= _w_size ? m - _w_size : 0
                } while (--n)

                n = _w_size
                p = n
                do {
                    m = s.prev[--p]
                    s.prev[p] = m >= _w_size ? m - _w_size : 0
                    /* If n is not on any hash chain, prev[n] is garbage but
                     * its value will never be used.
                     */
                } while (--n)

                more += _w_size
            }
            if (s.strm.avail_in === 0) {
                break
            }

            /* If there was no sliding:
             *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
             *    more == window_size - lookahead - strstart
             * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
             * => more >= window_size - 2*WSIZE + 2
             * In the BIG_MEM or MMAP case (not yet supported),
             *   window_size == input_size + MIN_LOOKAHEAD  &&
             *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
             * Otherwise, window_size == 2*WSIZE so more >= 2.
             * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
             */
            //Assert(more >= 2, "more < 2");
            n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more)
            s.lookahead += n

            /* Initialize the hash value now that we have some input: */
            if (s.lookahead + s.insert >= MIN_MATCH$1) {
                str = s.strstart - s.insert
                s.ins_h = s.window[str]

                /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
                s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask
                //#if MIN_MATCH != 3
                //        Call update_hash() MIN_MATCH-3 more times
                //#endif
                while (s.insert) {
                    /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
                    s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH$1 - 1]) & s.hash_mask

                    s.prev[str & s.w_mask] = s.head[s.ins_h]
                    s.head[s.ins_h] = str
                    str++
                    s.insert--
                    if (s.lookahead + s.insert < MIN_MATCH$1) {
                        break
                    }
                }
            }
            /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
             * but this is not important since only literal bytes will be emitted.
             */
        } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0)

        /* If the WIN_INIT bytes after the end of the current data have never been
         * written, then zero those bytes in order to avoid memory check reports of
         * the use of uninitialized (or uninitialised as Julian writes) bytes by
         * the longest match routines.  Update the high water mark for the next
         * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
         * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
         */
        //  if (s.high_water < s.window_size) {
        //    var curr = s.strstart + s.lookahead;
        //    var init = 0;
        //
        //    if (s.high_water < curr) {
        //      /* Previous high water mark below current data -- zero WIN_INIT
        //       * bytes or up to end of window, whichever is less.
        //       */
        //      init = s.window_size - curr;
        //      if (init > WIN_INIT)
        //        init = WIN_INIT;
        //      zmemzero(s->window + curr, (unsigned)init);
        //      s->high_water = curr + init;
        //    }
        //    else if (s->high_water < (ulg)curr + WIN_INIT) {
        //      /* High water mark at or above current data, but below current data
        //       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
        //       * to end of window, whichever is less.
        //       */
        //      init = (ulg)curr + WIN_INIT - s->high_water;
        //      if (init > s->window_size - s->high_water)
        //        init = s->window_size - s->high_water;
        //      zmemzero(s->window + s->high_water, (unsigned)init);
        //      s->high_water += init;
        //    }
        //  }
        //
        //  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
        //    "not enough room for search");
    }

    /* ===========================================================================
     * Copy without compression as much as possible from the input stream, return
     * the current block state.
     * This function does not insert new strings in the dictionary since
     * uncompressible data is probably not useful. This function is used
     * only for the level=0 compression option.
     * NOTE: this function should be optimized to avoid extra copying from
     * window to pending_buf.
     */
    function deflate_stored(s, flush) {
        /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
         * to pending_buf_size, and each stored block has a 5 byte header:
         */
        var max_block_size = 0xffff

        if (max_block_size > s.pending_buf_size - 5) {
            max_block_size = s.pending_buf_size - 5
        }

        /* Copy as much as possible from input to output: */
        for (;;) {
            /* Fill the window as much as possible: */
            if (s.lookahead <= 1) {
                //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
                //  s->block_start >= (long)s->w_size, "slide too late");
                //      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
                //        s.block_start >= s.w_size)) {
                //        throw  new Error("slide too late");
                //      }

                fill_window(s)
                if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
                    return BS_NEED_MORE
                }

                if (s.lookahead === 0) {
                    break
                }
                /* flush the current block */
            }
            //Assert(s->block_start >= 0L, "block gone");
            //    if (s.block_start < 0) throw new Error("block gone");

            s.strstart += s.lookahead
            s.lookahead = 0

            /* Emit a stored block if pending_buf will be full: */
            var max_start = s.block_start + max_block_size

            if (s.strstart === 0 || s.strstart >= max_start) {
                /* strstart == 0 is possible when wraparound on 16-bit machine */
                s.lookahead = s.strstart - max_start
                s.strstart = max_start
                /*** FLUSH_BLOCK(s, 0); ***/
                flush_block_only(s, false)
                if (s.strm.avail_out === 0) {
                    return BS_NEED_MORE
                }
                /***/
            }
            /* Flush if we may have to slide, otherwise block_start may become
             * negative and the data will be gone:
             */
            if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
                /*** FLUSH_BLOCK(s, 0); ***/
                flush_block_only(s, false)
                if (s.strm.avail_out === 0) {
                    return BS_NEED_MORE
                }
                /***/
            }
        }

        s.insert = 0

        if (flush === Z_FINISH) {
            /*** FLUSH_BLOCK(s, 1); ***/
            flush_block_only(s, true)
            if (s.strm.avail_out === 0) {
                return BS_FINISH_STARTED
            }
            /***/
            return BS_FINISH_DONE
        }

        if (s.strstart > s.block_start) {
            /*** FLUSH_BLOCK(s, 0); ***/
            flush_block_only(s, false)
            if (s.strm.avail_out === 0) {
                return BS_NEED_MORE
            }
            /***/
        }

        return BS_NEED_MORE
    }

    /* ===========================================================================
     * Compress as much as possible from the input stream, return the current
     * block state.
     * This function does not perform lazy evaluation of matches and inserts
     * new strings in the dictionary only for unmatched strings or for short
     * matches. It is used only for the fast compression options.
     */
    function deflate_fast(s, flush) {
        var hash_head /* head of the hash chain */
        var bflush /* set if current block must be flushed */

        for (;;) {
            /* Make sure that we always have enough lookahead, except
             * at the end of the input file. We need MAX_MATCH bytes
             * for the next match, plus MIN_MATCH bytes to insert the
             * string following the next match.
             */
            if (s.lookahead < MIN_LOOKAHEAD) {
                fill_window(s)
                if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
                    return BS_NEED_MORE
                }
                if (s.lookahead === 0) {
                    break /* flush the current block */
                }
            }

            /* Insert the string window[strstart .. strstart+2] in the
             * dictionary, and set hash_head to the head of the hash chain:
             */
            hash_head = 0 /*NIL*/
            if (s.lookahead >= MIN_MATCH$1) {
                /*** INSERT_STRING(s, s.strstart, hash_head); ***/
                s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH$1 - 1]) & s.hash_mask
                hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
                s.head[s.ins_h] = s.strstart
                /***/
            }

            /* Find the longest match, discarding those <= prev_length.
             * At this point we have always match_length < MIN_MATCH
             */
            if (hash_head !== 0 /*NIL*/ && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
                /* To simplify the code, we prevent matches with the string
                 * of window index 0 (in particular we have to avoid a match
                 * of the string with itself at the start of the input file).
                 */
                s.match_length = longest_match(s, hash_head)
                /* longest_match() sets match_start */
            }
            if (s.match_length >= MIN_MATCH$1) {
                // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

                /*** _tr_tally_dist(s, s.strstart - s.match_start,
                         s.match_length - MIN_MATCH, bflush); ***/
                bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH$1)

                s.lookahead -= s.match_length

                /* Insert new strings in the hash table only if the match length
                 * is not too large. This saves time but degrades compression.
                 */
                if (s.match_length <= s.max_lazy_match /*max_insert_length*/ && s.lookahead >= MIN_MATCH$1) {
                    s.match_length-- /* string at strstart already in table */
                    do {
                        s.strstart++
                        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
                        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH$1 - 1]) & s.hash_mask
                        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
                        s.head[s.ins_h] = s.strstart
                        /***/
                        /* strstart never exceeds WSIZE-MAX_MATCH, so there are
                         * always MIN_MATCH bytes ahead.
                         */
                    } while (--s.match_length !== 0)
                    s.strstart++
                } else {
                    s.strstart += s.match_length
                    s.match_length = 0
                    s.ins_h = s.window[s.strstart]
                    /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
                    s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask

                    //#if MIN_MATCH != 3
                    //                Call UPDATE_HASH() MIN_MATCH-3 more times
                    //#endif
                    /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
                     * matter since it will be recomputed at next deflate call.
                     */
                }
            } else {
                /* No match, output a literal byte */
                //Tracevv((stderr,"%c", s.window[s.strstart]));
                /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
                bflush = trees._tr_tally(s, 0, s.window[s.strstart])

                s.lookahead--
                s.strstart++
            }
            if (bflush) {
                /*** FLUSH_BLOCK(s, 0); ***/
                flush_block_only(s, false)
                if (s.strm.avail_out === 0) {
                    return BS_NEED_MORE
                }
                /***/
            }
        }
        s.insert = s.strstart < MIN_MATCH$1 - 1 ? s.strstart : MIN_MATCH$1 - 1
        if (flush === Z_FINISH) {
            /*** FLUSH_BLOCK(s, 1); ***/
            flush_block_only(s, true)
            if (s.strm.avail_out === 0) {
                return BS_FINISH_STARTED
            }
            /***/
            return BS_FINISH_DONE
        }
        if (s.last_lit) {
            /*** FLUSH_BLOCK(s, 0); ***/
            flush_block_only(s, false)
            if (s.strm.avail_out === 0) {
                return BS_NEED_MORE
            }
            /***/
        }
        return BS_BLOCK_DONE
    }

    /* ===========================================================================
     * Same as above, but achieves better compression. We use a lazy
     * evaluation for matches: a match is finally adopted only if there is
     * no better match at the next window position.
     */
    function deflate_slow(s, flush) {
        var hash_head /* head of hash chain */
        var bflush /* set if current block must be flushed */

        var max_insert

        /* Process the input block. */
        for (;;) {
            /* Make sure that we always have enough lookahead, except
             * at the end of the input file. We need MAX_MATCH bytes
             * for the next match, plus MIN_MATCH bytes to insert the
             * string following the next match.
             */
            if (s.lookahead < MIN_LOOKAHEAD) {
                fill_window(s)
                if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
                    return BS_NEED_MORE
                }
                if (s.lookahead === 0) {
                    break
                } /* flush the current block */
            }

            /* Insert the string window[strstart .. strstart+2] in the
             * dictionary, and set hash_head to the head of the hash chain:
             */
            hash_head = 0 /*NIL*/
            if (s.lookahead >= MIN_MATCH$1) {
                /*** INSERT_STRING(s, s.strstart, hash_head); ***/
                s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH$1 - 1]) & s.hash_mask
                hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
                s.head[s.ins_h] = s.strstart
                /***/
            }

            /* Find the longest match, discarding those <= prev_length.
             */
            s.prev_length = s.match_length
            s.prev_match = s.match_start
            s.match_length = MIN_MATCH$1 - 1

            if (
                hash_head !== 0 /*NIL*/ &&
                s.prev_length < s.max_lazy_match &&
                s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD /*MAX_DIST(s)*/
            ) {
                /* To simplify the code, we prevent matches with the string
                 * of window index 0 (in particular we have to avoid a match
                 * of the string with itself at the start of the input file).
                 */
                s.match_length = longest_match(s, hash_head)
                /* longest_match() sets match_start */

                if (
                    s.match_length <= 5 &&
                    (s.strategy === Z_FILTERED ||
                        (s.match_length === MIN_MATCH$1 && s.strstart - s.match_start > 4096) /*TOO_FAR*/)
                ) {
                    /* If prev_match is also MIN_MATCH, match_start is garbage
                     * but we will ignore the current match anyway.
                     */
                    s.match_length = MIN_MATCH$1 - 1
                }
            }
            /* If there was a match at the previous step and the current
             * match is not better, output the previous match:
             */
            if (s.prev_length >= MIN_MATCH$1 && s.match_length <= s.prev_length) {
                max_insert = s.strstart + s.lookahead - MIN_MATCH$1
                /* Do not insert strings in hash table beyond this. */

                //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

                /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                         s.prev_length - MIN_MATCH, bflush);***/
                bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH$1)
                /* Insert in hash table all strings up to the end of the match.
                 * strstart-1 and strstart are already inserted. If there is not
                 * enough lookahead, the last two strings are not inserted in
                 * the hash table.
                 */
                s.lookahead -= s.prev_length - 1
                s.prev_length -= 2
                do {
                    if (++s.strstart <= max_insert) {
                        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
                        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH$1 - 1]) & s.hash_mask
                        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
                        s.head[s.ins_h] = s.strstart
                        /***/
                    }
                } while (--s.prev_length !== 0)
                s.match_available = 0
                s.match_length = MIN_MATCH$1 - 1
                s.strstart++

                if (bflush) {
                    /*** FLUSH_BLOCK(s, 0); ***/
                    flush_block_only(s, false)
                    if (s.strm.avail_out === 0) {
                        return BS_NEED_MORE
                    }
                    /***/
                }
            } else if (s.match_available) {
                /* If there was no match at the previous position, output a
                 * single literal. If there was a match but the current match
                 * is longer, truncate the previous match to a single literal.
                 */
                //Tracevv((stderr,"%c", s->window[s->strstart-1]));
                /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
                bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1])

                if (bflush) {
                    /*** FLUSH_BLOCK_ONLY(s, 0) ***/
                    flush_block_only(s, false)
                    /***/
                }
                s.strstart++
                s.lookahead--
                if (s.strm.avail_out === 0) {
                    return BS_NEED_MORE
                }
            } else {
                /* There is no previous match to compare with, wait for
                 * the next step to decide.
                 */
                s.match_available = 1
                s.strstart++
                s.lookahead--
            }
        }
        //Assert (flush != Z_NO_FLUSH, "no flush?");
        if (s.match_available) {
            //Tracevv((stderr,"%c", s->window[s->strstart-1]));
            /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
            bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1])

            s.match_available = 0
        }
        s.insert = s.strstart < MIN_MATCH$1 - 1 ? s.strstart : MIN_MATCH$1 - 1
        if (flush === Z_FINISH) {
            /*** FLUSH_BLOCK(s, 1); ***/
            flush_block_only(s, true)
            if (s.strm.avail_out === 0) {
                return BS_FINISH_STARTED
            }
            /***/
            return BS_FINISH_DONE
        }
        if (s.last_lit) {
            /*** FLUSH_BLOCK(s, 0); ***/
            flush_block_only(s, false)
            if (s.strm.avail_out === 0) {
                return BS_NEED_MORE
            }
            /***/
        }

        return BS_BLOCK_DONE
    }

    /* ===========================================================================
     * For Z_RLE, simply look for runs of bytes, generate matches only of distance
     * one.  Do not maintain a hash table.  (It will be regenerated if this run of
     * deflate switches away from Z_RLE.)
     */
    function deflate_rle(s, flush) {
        var bflush /* set if current block must be flushed */
        var prev /* byte at distance one to match */
        var scan, strend /* scan goes up to strend for length of run */

        var _win = s.window

        for (;;) {
            /* Make sure that we always have enough lookahead, except
             * at the end of the input file. We need MAX_MATCH bytes
             * for the longest run, plus one for the unrolled loop.
             */
            if (s.lookahead <= MAX_MATCH$1) {
                fill_window(s)
                if (s.lookahead <= MAX_MATCH$1 && flush === Z_NO_FLUSH) {
                    return BS_NEED_MORE
                }
                if (s.lookahead === 0) {
                    break
                } /* flush the current block */
            }

            /* See how many times the previous byte repeats */
            s.match_length = 0
            if (s.lookahead >= MIN_MATCH$1 && s.strstart > 0) {
                scan = s.strstart - 1
                prev = _win[scan]
                if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
                    strend = s.strstart + MAX_MATCH$1
                    do {
                        /*jshint noempty:false*/
                    } while (
                        prev === _win[++scan] &&
                        prev === _win[++scan] &&
                        prev === _win[++scan] &&
                        prev === _win[++scan] &&
                        prev === _win[++scan] &&
                        prev === _win[++scan] &&
                        prev === _win[++scan] &&
                        prev === _win[++scan] &&
                        scan < strend
                    )
                    s.match_length = MAX_MATCH$1 - (strend - scan)
                    if (s.match_length > s.lookahead) {
                        s.match_length = s.lookahead
                    }
                }
                //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
            }

            /* Emit match if have run of MIN_MATCH or longer, else emit literal */
            if (s.match_length >= MIN_MATCH$1) {
                //check_match(s, s.strstart, s.strstart - 1, s.match_length);

                /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
                bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH$1)

                s.lookahead -= s.match_length
                s.strstart += s.match_length
                s.match_length = 0
            } else {
                /* No match, output a literal byte */
                //Tracevv((stderr,"%c", s->window[s->strstart]));
                /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
                bflush = trees._tr_tally(s, 0, s.window[s.strstart])

                s.lookahead--
                s.strstart++
            }
            if (bflush) {
                /*** FLUSH_BLOCK(s, 0); ***/
                flush_block_only(s, false)
                if (s.strm.avail_out === 0) {
                    return BS_NEED_MORE
                }
                /***/
            }
        }
        s.insert = 0
        if (flush === Z_FINISH) {
            /*** FLUSH_BLOCK(s, 1); ***/
            flush_block_only(s, true)
            if (s.strm.avail_out === 0) {
                return BS_FINISH_STARTED
            }
            /***/
            return BS_FINISH_DONE
        }
        if (s.last_lit) {
            /*** FLUSH_BLOCK(s, 0); ***/
            flush_block_only(s, false)
            if (s.strm.avail_out === 0) {
                return BS_NEED_MORE
            }
            /***/
        }
        return BS_BLOCK_DONE
    }

    /* ===========================================================================
     * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
     * (It will be regenerated if this run of deflate switches away from Huffman.)
     */
    function deflate_huff(s, flush) {
        var bflush /* set if current block must be flushed */

        for (;;) {
            /* Make sure that we have a literal to write. */
            if (s.lookahead === 0) {
                fill_window(s)
                if (s.lookahead === 0) {
                    if (flush === Z_NO_FLUSH) {
                        return BS_NEED_MORE
                    }
                    break /* flush the current block */
                }
            }

            /* Output a literal byte */
            s.match_length = 0
            //Tracevv((stderr,"%c", s->window[s->strstart]));
            /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
            bflush = trees._tr_tally(s, 0, s.window[s.strstart])
            s.lookahead--
            s.strstart++
            if (bflush) {
                /*** FLUSH_BLOCK(s, 0); ***/
                flush_block_only(s, false)
                if (s.strm.avail_out === 0) {
                    return BS_NEED_MORE
                }
                /***/
            }
        }
        s.insert = 0
        if (flush === Z_FINISH) {
            /*** FLUSH_BLOCK(s, 1); ***/
            flush_block_only(s, true)
            if (s.strm.avail_out === 0) {
                return BS_FINISH_STARTED
            }
            /***/
            return BS_FINISH_DONE
        }
        if (s.last_lit) {
            /*** FLUSH_BLOCK(s, 0); ***/
            flush_block_only(s, false)
            if (s.strm.avail_out === 0) {
                return BS_NEED_MORE
            }
            /***/
        }
        return BS_BLOCK_DONE
    }

    /* Values for max_lazy_match, good_match and max_chain_length, depending on
     * the desired pack level (0..9). The values given below have been tuned to
     * exclude worst case performance for pathological files. Better values may be
     * found for specific files.
     */
    function Config(good_length, max_lazy, nice_length, max_chain, func) {
        this.good_length = good_length
        this.max_lazy = max_lazy
        this.nice_length = nice_length
        this.max_chain = max_chain
        this.func = func
    }

    var configuration_table

    configuration_table = [
        /*      good lazy nice chain */
        new Config(0, 0, 0, 0, deflate_stored) /* 0 store only */,
        new Config(4, 4, 8, 4, deflate_fast) /* 1 max speed, no lazy matches */,
        new Config(4, 5, 16, 8, deflate_fast) /* 2 */,
        new Config(4, 6, 32, 32, deflate_fast) /* 3 */,

        new Config(4, 4, 16, 16, deflate_slow) /* 4 lazy matches */,
        new Config(8, 16, 32, 32, deflate_slow) /* 5 */,
        new Config(8, 16, 128, 128, deflate_slow) /* 6 */,
        new Config(8, 32, 128, 256, deflate_slow) /* 7 */,
        new Config(32, 128, 258, 1024, deflate_slow) /* 8 */,
        new Config(32, 258, 258, 4096, deflate_slow) /* 9 max compression */
    ]

    /* ===========================================================================
     * Initialize the "longest match" routines for a new zlib stream
     */
    function lm_init(s) {
        s.window_size = 2 * s.w_size

        /*** CLEAR_HASH(s); ***/
        zero$1(s.head) // Fill with NIL (= 0);

        /* Set the default configuration parameters:
         */
        s.max_lazy_match = configuration_table[s.level].max_lazy
        s.good_match = configuration_table[s.level].good_length
        s.nice_match = configuration_table[s.level].nice_length
        s.max_chain_length = configuration_table[s.level].max_chain

        s.strstart = 0
        s.block_start = 0
        s.lookahead = 0
        s.insert = 0
        s.match_length = s.prev_length = MIN_MATCH$1 - 1
        s.match_available = 0
        s.ins_h = 0
    }

    function DeflateState() {
        this.strm = null /* pointer back to this zlib stream */
        this.status = 0 /* as the name implies */
        this.pending_buf = null /* output still pending */
        this.pending_buf_size = 0 /* size of pending_buf */
        this.pending_out = 0 /* next pending byte to output to the stream */
        this.pending = 0 /* nb of bytes in the pending buffer */
        this.wrap = 0 /* bit 0 true for zlib, bit 1 true for gzip */
        this.gzhead = null /* gzip header information to write */
        this.gzindex = 0 /* where in extra, name, or comment */
        this.method = Z_DEFLATED /* can only be DEFLATED */
        this.last_flush = -1 /* value of flush param for previous deflate call */

        this.w_size = 0 /* LZ77 window size (32K by default) */
        this.w_bits = 0 /* log2(w_size)  (8..16) */
        this.w_mask = 0 /* w_size - 1 */

        this.window = null
        /* Sliding window. Input bytes are read into the second half of the window,
         * and move to the first half later to keep a dictionary of at least wSize
         * bytes. With this organization, matches are limited to a distance of
         * wSize-MAX_MATCH bytes, but this ensures that IO is always
         * performed with a length multiple of the block size.
         */

        this.window_size = 0
        /* Actual size of window: 2*wSize, except when the user input buffer
         * is directly used as sliding window.
         */

        this.prev = null
        /* Link to older string with same hash index. To limit the size of this
         * array to 64K, this link is maintained only for the last 32K strings.
         * An index in this array is thus a window index modulo 32K.
         */

        this.head = null /* Heads of the hash chains or NIL. */

        this.ins_h = 0 /* hash index of string to be inserted */
        this.hash_size = 0 /* number of elements in hash table */
        this.hash_bits = 0 /* log2(hash_size) */
        this.hash_mask = 0 /* hash_size-1 */

        this.hash_shift = 0
        /* Number of bits by which ins_h must be shifted at each input
         * step. It must be such that after MIN_MATCH steps, the oldest
         * byte no longer takes part in the hash key, that is:
         *   hash_shift * MIN_MATCH >= hash_bits
         */

        this.block_start = 0
        /* Window position at the beginning of the current output block. Gets
         * negative when the window is moved backwards.
         */

        this.match_length = 0 /* length of best match */
        this.prev_match = 0 /* previous match */
        this.match_available = 0 /* set if previous match exists */
        this.strstart = 0 /* start of string to insert */
        this.match_start = 0 /* start of matching string */
        this.lookahead = 0 /* number of valid bytes ahead in window */

        this.prev_length = 0
        /* Length of the best match at previous step. Matches not greater than this
         * are discarded. This is used in the lazy match evaluation.
         */

        this.max_chain_length = 0
        /* To speed up deflation, hash chains are never searched beyond this
         * length.  A higher limit improves compression ratio but degrades the
         * speed.
         */

        this.max_lazy_match = 0
        /* Attempt to find a better match only when the current match is strictly
         * smaller than this value. This mechanism is used only for compression
         * levels >= 4.
         */
        // That's alias to max_lazy_match, don't use directly
        //this.max_insert_length = 0;
        /* Insert new strings in the hash table only if the match length is not
         * greater than this length. This saves time but degrades compression.
         * max_insert_length is used only for compression levels <= 3.
         */

        this.level = 0 /* compression level (1..9) */
        this.strategy = 0 /* favor or force Huffman coding*/

        this.good_match = 0
        /* Use a faster search when the previous match is longer than this */

        this.nice_match = 0 /* Stop searching when current match exceeds this */

        /* used by trees.c: */

        /* Didn't use ct_data typedef below to suppress compiler warning */

        // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
        // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
        // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

        // Use flat array of DOUBLE size, with interleaved fata,
        // because JS does not support effective
        this.dyn_ltree = new common.Buf16(HEAP_SIZE$1 * 2)
        this.dyn_dtree = new common.Buf16((2 * D_CODES$1 + 1) * 2)
        this.bl_tree = new common.Buf16((2 * BL_CODES$1 + 1) * 2)
        zero$1(this.dyn_ltree)
        zero$1(this.dyn_dtree)
        zero$1(this.bl_tree)

        this.l_desc = null /* desc. for literal tree */
        this.d_desc = null /* desc. for distance tree */
        this.bl_desc = null /* desc. for bit length tree */

        //ush bl_count[MAX_BITS+1];
        this.bl_count = new common.Buf16(MAX_BITS$1 + 1)
        /* number of codes at each bit length for an optimal tree */

        //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
        this.heap = new common.Buf16(2 * L_CODES$1 + 1) /* heap used to build the Huffman trees */
        zero$1(this.heap)

        this.heap_len = 0 /* number of elements in the heap */
        this.heap_max = 0 /* element of largest frequency */
        /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
         * The same heap array is used to build all trees.
         */

        this.depth = new common.Buf16(2 * L_CODES$1 + 1) //uch depth[2*L_CODES+1];
        zero$1(this.depth)
        /* Depth of each subtree used as tie breaker for trees of equal frequency
         */

        this.l_buf = 0 /* buffer index for literals or lengths */

        this.lit_bufsize = 0
        /* Size of match buffer for literals/lengths.  There are 4 reasons for
         * limiting lit_bufsize to 64K:
         *   - frequencies can be kept in 16 bit counters
         *   - if compression is not successful for the first block, all input
         *     data is still in the window so we can still emit a stored block even
         *     when input comes from standard input.  (This can also be done for
         *     all blocks if lit_bufsize is not greater than 32K.)
         *   - if compression is not successful for a file smaller than 64K, we can
         *     even emit a stored file instead of a stored block (saving 5 bytes).
         *     This is applicable only for zip (not gzip or zlib).
         *   - creating new Huffman trees less frequently may not provide fast
         *     adaptation to changes in the input data statistics. (Take for
         *     example a binary file with poorly compressible code followed by
         *     a highly compressible string table.) Smaller buffer sizes give
         *     fast adaptation but have of course the overhead of transmitting
         *     trees more frequently.
         *   - I can't count above 4
         */

        this.last_lit = 0 /* running index in l_buf */

        this.d_buf = 0
        /* Buffer index for distances. To simplify the code, d_buf and l_buf have
         * the same number of elements. To use different lengths, an extra flag
         * array would be necessary.
         */

        this.opt_len = 0 /* bit length of current block with optimal trees */
        this.static_len = 0 /* bit length of current block with static trees */
        this.matches = 0 /* number of string matches in current block */
        this.insert = 0 /* bytes at end of window left to insert */

        this.bi_buf = 0
        /* Output buffer. bits are inserted starting at the bottom (least
         * significant bits).
         */
        this.bi_valid = 0
        /* Number of valid bits in bi_buf.  All bits above the last valid bit
         * are always zero.
         */

        // Used for window memory init. We safely ignore it for JS. That makes
        // sense only for pointers and memory check tools.
        //this.high_water = 0;
        /* High water mark offset in window for initialized bytes -- bytes above
         * this are set to zero in order to avoid memory check warnings when
         * longest match routines access bytes past the input.  This is then
         * updated to the new high water mark.
         */
    }

    function deflateResetKeep(strm) {
        var s

        if (!strm || !strm.state) {
            return err(strm, Z_STREAM_ERROR)
        }

        strm.total_in = strm.total_out = 0
        strm.data_type = Z_UNKNOWN$1

        s = strm.state
        s.pending = 0
        s.pending_out = 0

        if (s.wrap < 0) {
            s.wrap = -s.wrap
            /* was made negative by deflate(..., Z_FINISH); */
        }
        s.status = s.wrap ? INIT_STATE : BUSY_STATE
        strm.adler =
            s.wrap === 2
                ? 0 // crc32(0, Z_NULL, 0)
                : 1 // adler32(0, Z_NULL, 0)
        s.last_flush = Z_NO_FLUSH
        trees._tr_init(s)
        return Z_OK
    }

    function deflateReset(strm) {
        var ret = deflateResetKeep(strm)
        if (ret === Z_OK) {
            lm_init(strm.state)
        }
        return ret
    }

    function deflateSetHeader(strm, head) {
        if (!strm || !strm.state) {
            return Z_STREAM_ERROR
        }
        if (strm.state.wrap !== 2) {
            return Z_STREAM_ERROR
        }
        strm.state.gzhead = head
        return Z_OK
    }

    function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
        if (!strm) {
            // === Z_NULL
            return Z_STREAM_ERROR
        }
        var wrap = 1

        if (level === Z_DEFAULT_COMPRESSION) {
            level = 6
        }

        if (windowBits < 0) {
            /* suppress zlib wrapper */
            wrap = 0
            windowBits = -windowBits
        } else if (windowBits > 15) {
            wrap = 2 /* write gzip wrapper instead */
            windowBits -= 16
        }

        if (
            memLevel < 1 ||
            memLevel > MAX_MEM_LEVEL ||
            method !== Z_DEFLATED ||
            windowBits < 8 ||
            windowBits > 15 ||
            level < 0 ||
            level > 9 ||
            strategy < 0 ||
            strategy > Z_FIXED$1
        ) {
            return err(strm, Z_STREAM_ERROR)
        }

        if (windowBits === 8) {
            windowBits = 9
        }
        /* until 256-byte window bug fixed */

        var s = new DeflateState()

        strm.state = s
        s.strm = strm

        s.wrap = wrap
        s.gzhead = null
        s.w_bits = windowBits
        s.w_size = 1 << s.w_bits
        s.w_mask = s.w_size - 1

        s.hash_bits = memLevel + 7
        s.hash_size = 1 << s.hash_bits
        s.hash_mask = s.hash_size - 1
        s.hash_shift = ~~((s.hash_bits + MIN_MATCH$1 - 1) / MIN_MATCH$1)

        s.window = new common.Buf8(s.w_size * 2)
        s.head = new common.Buf16(s.hash_size)
        s.prev = new common.Buf16(s.w_size)

        // Don't need mem init magic for JS.
        //s.high_water = 0;  /* nothing written to s->window yet */

        s.lit_bufsize = 1 << (memLevel + 6) /* 16K elements by default */

        s.pending_buf_size = s.lit_bufsize * 4

        //overlay = (ushf *) ZALLOC(strm, s->lit_bufsize, sizeof(ush)+2);
        //s->pending_buf = (uchf *) overlay;
        s.pending_buf = new common.Buf8(s.pending_buf_size)

        // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
        //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
        s.d_buf = 1 * s.lit_bufsize

        //s->l_buf = s->pending_buf + (1+sizeof(ush))*s->lit_bufsize;
        s.l_buf = (1 + 2) * s.lit_bufsize

        s.level = level
        s.strategy = strategy
        s.method = method

        return deflateReset(strm)
    }

    function deflateInit(strm, level) {
        return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY)
    }

    function deflate(strm, flush) {
        var old_flush, s
        var beg, val // for gzip header write only

        if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) {
            return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR
        }

        s = strm.state

        if (!strm.output || (!strm.input && strm.avail_in !== 0) || (s.status === FINISH_STATE && flush !== Z_FINISH)) {
            return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR)
        }

        s.strm = strm /* just in case */
        old_flush = s.last_flush
        s.last_flush = flush

        /* Write the header */
        if (s.status === INIT_STATE) {
            if (s.wrap === 2) {
                // GZIP header
                strm.adler = 0 //crc32(0L, Z_NULL, 0);
                put_byte(s, 31)
                put_byte(s, 139)
                put_byte(s, 8)
                if (!s.gzhead) {
                    // s->gzhead == Z_NULL
                    put_byte(s, 0)
                    put_byte(s, 0)
                    put_byte(s, 0)
                    put_byte(s, 0)
                    put_byte(s, 0)
                    put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0)
                    put_byte(s, OS_CODE)
                    s.status = BUSY_STATE
                } else {
                    put_byte(
                        s,
                        (s.gzhead.text ? 1 : 0) +
                            (s.gzhead.hcrc ? 2 : 0) +
                            (!s.gzhead.extra ? 0 : 4) +
                            (!s.gzhead.name ? 0 : 8) +
                            (!s.gzhead.comment ? 0 : 16)
                    )
                    put_byte(s, s.gzhead.time & 0xff)
                    put_byte(s, (s.gzhead.time >> 8) & 0xff)
                    put_byte(s, (s.gzhead.time >> 16) & 0xff)
                    put_byte(s, (s.gzhead.time >> 24) & 0xff)
                    put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0)
                    put_byte(s, s.gzhead.os & 0xff)
                    if (s.gzhead.extra && s.gzhead.extra.length) {
                        put_byte(s, s.gzhead.extra.length & 0xff)
                        put_byte(s, (s.gzhead.extra.length >> 8) & 0xff)
                    }
                    if (s.gzhead.hcrc) {
                        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0)
                    }
                    s.gzindex = 0
                    s.status = EXTRA_STATE
                }
            } // DEFLATE header
            else {
                var header = (Z_DEFLATED + ((s.w_bits - 8) << 4)) << 8
                var level_flags = -1

                if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
                    level_flags = 0
                } else if (s.level < 6) {
                    level_flags = 1
                } else if (s.level === 6) {
                    level_flags = 2
                } else {
                    level_flags = 3
                }
                header |= level_flags << 6
                if (s.strstart !== 0) {
                    header |= PRESET_DICT
                }
                header += 31 - (header % 31)

                s.status = BUSY_STATE
                putShortMSB(s, header)

                /* Save the adler32 of the preset dictionary: */
                if (s.strstart !== 0) {
                    putShortMSB(s, strm.adler >>> 16)
                    putShortMSB(s, strm.adler & 0xffff)
                }
                strm.adler = 1 // adler32(0L, Z_NULL, 0);
            }
        }

        //#ifdef GZIP
        if (s.status === EXTRA_STATE) {
            if (s.gzhead.extra /* != Z_NULL*/) {
                beg = s.pending /* start of bytes to update crc */

                while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
                    if (s.pending === s.pending_buf_size) {
                        if (s.gzhead.hcrc && s.pending > beg) {
                            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
                        }
                        flush_pending(strm)
                        beg = s.pending
                        if (s.pending === s.pending_buf_size) {
                            break
                        }
                    }
                    put_byte(s, s.gzhead.extra[s.gzindex] & 0xff)
                    s.gzindex++
                }
                if (s.gzhead.hcrc && s.pending > beg) {
                    strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
                }
                if (s.gzindex === s.gzhead.extra.length) {
                    s.gzindex = 0
                    s.status = NAME_STATE
                }
            } else {
                s.status = NAME_STATE
            }
        }
        if (s.status === NAME_STATE) {
            if (s.gzhead.name /* != Z_NULL*/) {
                beg = s.pending /* start of bytes to update crc */
                //int val;

                do {
                    if (s.pending === s.pending_buf_size) {
                        if (s.gzhead.hcrc && s.pending > beg) {
                            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
                        }
                        flush_pending(strm)
                        beg = s.pending
                        if (s.pending === s.pending_buf_size) {
                            val = 1
                            break
                        }
                    }
                    // JS specific: little magic to add zero terminator to end of string
                    if (s.gzindex < s.gzhead.name.length) {
                        val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff
                    } else {
                        val = 0
                    }
                    put_byte(s, val)
                } while (val !== 0)

                if (s.gzhead.hcrc && s.pending > beg) {
                    strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
                }
                if (val === 0) {
                    s.gzindex = 0
                    s.status = COMMENT_STATE
                }
            } else {
                s.status = COMMENT_STATE
            }
        }
        if (s.status === COMMENT_STATE) {
            if (s.gzhead.comment /* != Z_NULL*/) {
                beg = s.pending /* start of bytes to update crc */
                //int val;

                do {
                    if (s.pending === s.pending_buf_size) {
                        if (s.gzhead.hcrc && s.pending > beg) {
                            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
                        }
                        flush_pending(strm)
                        beg = s.pending
                        if (s.pending === s.pending_buf_size) {
                            val = 1
                            break
                        }
                    }
                    // JS specific: little magic to add zero terminator to end of string
                    if (s.gzindex < s.gzhead.comment.length) {
                        val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff
                    } else {
                        val = 0
                    }
                    put_byte(s, val)
                } while (val !== 0)

                if (s.gzhead.hcrc && s.pending > beg) {
                    strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
                }
                if (val === 0) {
                    s.status = HCRC_STATE
                }
            } else {
                s.status = HCRC_STATE
            }
        }
        if (s.status === HCRC_STATE) {
            if (s.gzhead.hcrc) {
                if (s.pending + 2 > s.pending_buf_size) {
                    flush_pending(strm)
                }
                if (s.pending + 2 <= s.pending_buf_size) {
                    put_byte(s, strm.adler & 0xff)
                    put_byte(s, (strm.adler >> 8) & 0xff)
                    strm.adler = 0 //crc32(0L, Z_NULL, 0);
                    s.status = BUSY_STATE
                }
            } else {
                s.status = BUSY_STATE
            }
        }
        //#endif

        /* Flush as much pending output as possible */
        if (s.pending !== 0) {
            flush_pending(strm)
            if (strm.avail_out === 0) {
                /* Since avail_out is 0, deflate will be called again with
                 * more output space, but possibly with both pending and
                 * avail_in equal to zero. There won't be anything to do,
                 * but this is not an error situation so make sure we
                 * return OK instead of BUF_ERROR at next call of deflate:
                 */
                s.last_flush = -1
                return Z_OK
            }

            /* Make sure there is something to do and avoid duplicate consecutive
             * flushes. For repeated and useless calls with Z_FINISH, we keep
             * returning Z_STREAM_END instead of Z_BUF_ERROR.
             */
        } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) {
            return err(strm, Z_BUF_ERROR)
        }

        /* User must not provide more input after the first FINISH: */
        if (s.status === FINISH_STATE && strm.avail_in !== 0) {
            return err(strm, Z_BUF_ERROR)
        }

        /* Start a new block or continue the current one.
         */
        if (strm.avail_in !== 0 || s.lookahead !== 0 || (flush !== Z_NO_FLUSH && s.status !== FINISH_STATE)) {
            var bstate =
                s.strategy === Z_HUFFMAN_ONLY
                    ? deflate_huff(s, flush)
                    : s.strategy === Z_RLE
                    ? deflate_rle(s, flush)
                    : configuration_table[s.level].func(s, flush)

            if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
                s.status = FINISH_STATE
            }
            if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
                if (strm.avail_out === 0) {
                    s.last_flush = -1
                    /* avoid BUF_ERROR next call, see above */
                }
                return Z_OK
                /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
                 * of deflate should use the same flush parameter to make sure
                 * that the flush is complete. So we don't have to output an
                 * empty block here, this will be done at next call. This also
                 * ensures that for a very small output buffer, we emit at most
                 * one empty block.
                 */
            }
            if (bstate === BS_BLOCK_DONE) {
                if (flush === Z_PARTIAL_FLUSH) {
                    trees._tr_align(s)
                } else if (flush !== Z_BLOCK) {
                    /* FULL_FLUSH or SYNC_FLUSH */

                    trees._tr_stored_block(s, 0, 0, false)
                    /* For a full flush, this empty block will be recognized
                     * as a special marker by inflate_sync().
                     */
                    if (flush === Z_FULL_FLUSH) {
                        /*** CLEAR_HASH(s); ***/ /* forget history */
                        zero$1(s.head) // Fill with NIL (= 0);

                        if (s.lookahead === 0) {
                            s.strstart = 0
                            s.block_start = 0
                            s.insert = 0
                        }
                    }
                }
                flush_pending(strm)
                if (strm.avail_out === 0) {
                    s.last_flush = -1 /* avoid BUF_ERROR at next call, see above */
                    return Z_OK
                }
            }
        }
        //Assert(strm->avail_out > 0, "bug2");
        //if (strm.avail_out <= 0) { throw new Error("bug2");}

        if (flush !== Z_FINISH) {
            return Z_OK
        }
        if (s.wrap <= 0) {
            return Z_STREAM_END
        }

        /* Write the trailer */
        if (s.wrap === 2) {
            put_byte(s, strm.adler & 0xff)
            put_byte(s, (strm.adler >> 8) & 0xff)
            put_byte(s, (strm.adler >> 16) & 0xff)
            put_byte(s, (strm.adler >> 24) & 0xff)
            put_byte(s, strm.total_in & 0xff)
            put_byte(s, (strm.total_in >> 8) & 0xff)
            put_byte(s, (strm.total_in >> 16) & 0xff)
            put_byte(s, (strm.total_in >> 24) & 0xff)
        } else {
            putShortMSB(s, strm.adler >>> 16)
            putShortMSB(s, strm.adler & 0xffff)
        }

        flush_pending(strm)
        /* If avail_out is zero, the application will call deflate again
         * to flush the rest.
         */
        if (s.wrap > 0) {
            s.wrap = -s.wrap
        }
        /* write the trailer only once! */
        return s.pending !== 0 ? Z_OK : Z_STREAM_END
    }

    function deflateEnd(strm) {
        var status

        if (!strm /*== Z_NULL*/ || !strm.state /*== Z_NULL*/) {
            return Z_STREAM_ERROR
        }

        status = strm.state.status
        if (
            status !== INIT_STATE &&
            status !== EXTRA_STATE &&
            status !== NAME_STATE &&
            status !== COMMENT_STATE &&
            status !== HCRC_STATE &&
            status !== BUSY_STATE &&
            status !== FINISH_STATE
        ) {
            return err(strm, Z_STREAM_ERROR)
        }

        strm.state = null

        return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK
    }

    /* =========================================================================
     * Initializes the compression dictionary from the given byte
     * sequence without producing any compressed output.
     */
    function deflateSetDictionary(strm, dictionary) {
        var dictLength = dictionary.length

        var s
        var str, n
        var wrap
        var avail
        var next
        var input
        var tmpDict

        if (!strm /*== Z_NULL*/ || !strm.state /*== Z_NULL*/) {
            return Z_STREAM_ERROR
        }

        s = strm.state
        wrap = s.wrap

        if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
            return Z_STREAM_ERROR
        }

        /* when using zlib wrappers, compute Adler-32 for provided dictionary */
        if (wrap === 1) {
            /* adler32(strm->adler, dictionary, dictLength); */
            strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0)
        }

        s.wrap = 0 /* avoid computing Adler-32 in read_buf */

        /* if dictionary would fill window, just replace the history */
        if (dictLength >= s.w_size) {
            if (wrap === 0) {
                /* already empty otherwise */
                /*** CLEAR_HASH(s); ***/
                zero$1(s.head) // Fill with NIL (= 0);
                s.strstart = 0
                s.block_start = 0
                s.insert = 0
            }
            /* use the tail */
            // dictionary = dictionary.slice(dictLength - s.w_size);
            tmpDict = new common.Buf8(s.w_size)
            common.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0)
            dictionary = tmpDict
            dictLength = s.w_size
        }
        /* insert dictionary into window and hash */
        avail = strm.avail_in
        next = strm.next_in
        input = strm.input
        strm.avail_in = dictLength
        strm.next_in = 0
        strm.input = dictionary
        fill_window(s)
        while (s.lookahead >= MIN_MATCH$1) {
            str = s.strstart
            n = s.lookahead - (MIN_MATCH$1 - 1)
            do {
                /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
                s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH$1 - 1]) & s.hash_mask

                s.prev[str & s.w_mask] = s.head[s.ins_h]

                s.head[s.ins_h] = str
                str++
            } while (--n)
            s.strstart = str
            s.lookahead = MIN_MATCH$1 - 1
            fill_window(s)
        }
        s.strstart += s.lookahead
        s.block_start = s.strstart
        s.insert = s.lookahead
        s.lookahead = 0
        s.match_length = s.prev_length = MIN_MATCH$1 - 1
        s.match_available = 0
        strm.next_in = next
        strm.input = input
        strm.avail_in = avail
        s.wrap = wrap
        return Z_OK
    }

    var deflateInit_1 = deflateInit
    var deflateInit2_1 = deflateInit2
    var deflateReset_1 = deflateReset
    var deflateResetKeep_1 = deflateResetKeep
    var deflateSetHeader_1 = deflateSetHeader
    var deflate_2 = deflate
    var deflateEnd_1 = deflateEnd
    var deflateSetDictionary_1 = deflateSetDictionary
    var deflateInfo = 'pako deflate (from Nodeca project)'

    /* Not implemented
    exports.deflateBound = deflateBound;
    exports.deflateCopy = deflateCopy;
    exports.deflateParams = deflateParams;
    exports.deflatePending = deflatePending;
    exports.deflatePrime = deflatePrime;
    exports.deflateTune = deflateTune;
    */

    var deflate_1 = {
        deflateInit: deflateInit_1,
        deflateInit2: deflateInit2_1,
        deflateReset: deflateReset_1,
        deflateResetKeep: deflateResetKeep_1,
        deflateSetHeader: deflateSetHeader_1,
        deflate: deflate_2,
        deflateEnd: deflateEnd_1,
        deflateSetDictionary: deflateSetDictionary_1,
        deflateInfo: deflateInfo
    }

    // Quick check if we can use fast array to bin string conversion
    //
    // - apply(Array) can fail on Android 2.2
    // - apply(Uint8Array) can fail on iOS 5.1 Safari
    //
    var STR_APPLY_OK = true
    var STR_APPLY_UIA_OK = true

    try {
        String.fromCharCode.apply(null, [0])
    } catch (__) {
        STR_APPLY_OK = false
    }
    try {
        String.fromCharCode.apply(null, new Uint8Array(1))
    } catch (__) {
        STR_APPLY_UIA_OK = false
    }

    // Table with utf8 lengths (calculated by first byte of sequence)
    // Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
    // because max possible codepoint is 0x10ffff
    var _utf8len = new common.Buf8(256)
    for (var q = 0; q < 256; q++) {
        _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1
    }
    _utf8len[254] = _utf8len[254] = 1 // Invalid sequence start

    // convert string to array (typed, when possible)
    var string2buf = function (str) {
        var buf,
            c,
            c2,
            m_pos,
            i,
            str_len = str.length,
            buf_len = 0

        // count binary size
        for (m_pos = 0; m_pos < str_len; m_pos++) {
            c = str.charCodeAt(m_pos)
            if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
                c2 = str.charCodeAt(m_pos + 1)
                if ((c2 & 0xfc00) === 0xdc00) {
                    c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
                    m_pos++
                }
            }
            buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
        }

        // allocate buffer
        buf = new common.Buf8(buf_len)

        // convert
        for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
            c = str.charCodeAt(m_pos)
            if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
                c2 = str.charCodeAt(m_pos + 1)
                if ((c2 & 0xfc00) === 0xdc00) {
                    c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
                    m_pos++
                }
            }
            if (c < 0x80) {
                /* one byte */
                buf[i++] = c
            } else if (c < 0x800) {
                /* two bytes */
                buf[i++] = 0xc0 | (c >>> 6)
                buf[i++] = 0x80 | (c & 0x3f)
            } else if (c < 0x10000) {
                /* three bytes */
                buf[i++] = 0xe0 | (c >>> 12)
                buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
                buf[i++] = 0x80 | (c & 0x3f)
            } else {
                /* four bytes */
                buf[i++] = 0xf0 | (c >>> 18)
                buf[i++] = 0x80 | ((c >>> 12) & 0x3f)
                buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
                buf[i++] = 0x80 | (c & 0x3f)
            }
        }

        return buf
    }

    // Helper (used in 2 places)
    function buf2binstring(buf, len) {
        // On Chrome, the arguments in a function call that are allowed is `65534`.
        // If the length of the buffer is smaller than that, we can use this optimization,
        // otherwise we will take a slower path.
        if (len < 65534) {
            if ((buf.subarray && STR_APPLY_UIA_OK) || (!buf.subarray && STR_APPLY_OK)) {
                return String.fromCharCode.apply(null, common.shrinkBuf(buf, len))
            }
        }

        var result = ''
        for (var i = 0; i < len; i++) {
            result += String.fromCharCode(buf[i])
        }
        return result
    }

    // Convert byte array to binary string
    var buf2binstring_1 = function (buf) {
        return buf2binstring(buf, buf.length)
    }

    // Convert binary string (typed, when possible)
    var binstring2buf = function (str) {
        var buf = new common.Buf8(str.length)
        for (var i = 0, len = buf.length; i < len; i++) {
            buf[i] = str.charCodeAt(i)
        }
        return buf
    }

    // convert array to string
    var buf2string = function (buf, max) {
        var i, out, c, c_len
        var len = max || buf.length

        // Reserve max possible length (2 words per char)
        // NB: by unknown reasons, Array is significantly faster for
        //     String.fromCharCode.apply than Uint16Array.
        var utf16buf = new Array(len * 2)

        for (out = 0, i = 0; i < len; ) {
            c = buf[i++]
            // quick process ascii
            if (c < 0x80) {
                utf16buf[out++] = c
                continue
            }

            c_len = _utf8len[c]
            // skip 5 & 6 byte codes
            if (c_len > 4) {
                utf16buf[out++] = 0xfffd
                i += c_len - 1
                continue
            }

            // apply mask on first byte
            c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07
            // join the rest
            while (c_len > 1 && i < len) {
                c = (c << 6) | (buf[i++] & 0x3f)
                c_len--
            }

            // terminated by end of string?
            if (c_len > 1) {
                utf16buf[out++] = 0xfffd
                continue
            }

            if (c < 0x10000) {
                utf16buf[out++] = c
            } else {
                c -= 0x10000
                utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff)
                utf16buf[out++] = 0xdc00 | (c & 0x3ff)
            }
        }

        return buf2binstring(utf16buf, out)
    }

    // Calculate max possible position in utf8 buffer,
    // that will not break sequence. If that's not possible
    // - (very small limits) return max size as is.
    //
    // buf[] - utf8 bytes array
    // max   - length limit (mandatory);
    var utf8border = function (buf, max) {
        var pos

        max = max || buf.length
        if (max > buf.length) {
            max = buf.length
        }

        // go back from last position, until start of sequence found
        pos = max - 1
        while (pos >= 0 && (buf[pos] & 0xc0) === 0x80) {
            pos--
        }

        // Very small and broken sequence,
        // return max, because we should return something anyway.
        if (pos < 0) {
            return max
        }

        // If we came to start of buffer - that means buffer is too small,
        // return max too.
        if (pos === 0) {
            return max
        }

        return pos + _utf8len[buf[pos]] > max ? pos : max
    }

    var strings = {
        string2buf: string2buf,
        buf2binstring: buf2binstring_1,
        binstring2buf: binstring2buf,
        buf2string: buf2string,
        utf8border: utf8border
    }

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    function ZStream() {
        /* next input byte */
        this.input = null // JS specific, because we have no pointers
        this.next_in = 0
        /* number of bytes available at input */
        this.avail_in = 0
        /* total number of input bytes read so far */
        this.total_in = 0
        /* next output byte should be put there */
        this.output = null // JS specific, because we have no pointers
        this.next_out = 0
        /* remaining free space at output */
        this.avail_out = 0
        /* total number of bytes output so far */
        this.total_out = 0
        /* last error message, NULL if no error */
        this.msg = '' /*Z_NULL*/
        /* not visible by applications */
        this.state = null
        /* best guess about the data type: binary or text */
        this.data_type = 2 /*Z_UNKNOWN*/
        /* adler32 value of the uncompressed data */
        this.adler = 0
    }

    var zstream = ZStream

    var toString = Object.prototype.toString

    /* Public constants ==========================================================*/
    /* ===========================================================================*/

    var Z_NO_FLUSH$1 = 0
    var Z_FINISH$1 = 4

    var Z_OK$1 = 0
    var Z_STREAM_END$1 = 1
    var Z_SYNC_FLUSH = 2

    var Z_DEFAULT_COMPRESSION$1 = -1

    var Z_DEFAULT_STRATEGY$1 = 0

    var Z_DEFLATED$1 = 8

    /* ===========================================================================*/

    /**
     * class Deflate
     *
     * Generic JS-style wrapper for zlib calls. If you don't need
     * streaming behaviour - use more simple functions: [[deflate]],
     * [[deflateRaw]] and [[gzip]].
     **/

    /* internal
     * Deflate.chunks -> Array
     *
     * Chunks of output data, if [[Deflate#onData]] not overridden.
     **/

    /**
     * Deflate.result -> Uint8Array|Array
     *
     * Compressed result, generated by default [[Deflate#onData]]
     * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
     * (call [[Deflate#push]] with `Z_FINISH` / `true` param)  or if you
     * push a chunk with explicit flush (call [[Deflate#push]] with
     * `Z_SYNC_FLUSH` param).
     **/

    /**
     * Deflate.err -> Number
     *
     * Error code after deflate finished. 0 (Z_OK) on success.
     * You will not need it in real life, because deflate errors
     * are possible only on wrong options or bad `onData` / `onEnd`
     * custom handlers.
     **/

    /**
     * Deflate.msg -> String
     *
     * Error message, if [[Deflate.err]] != 0
     **/

    /**
     * new Deflate(options)
     * - options (Object): zlib deflate options.
     *
     * Creates new deflator instance with specified params. Throws exception
     * on bad params. Supported options:
     *
     * - `level`
     * - `windowBits`
     * - `memLevel`
     * - `strategy`
     * - `dictionary`
     *
     * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
     * for more information on these.
     *
     * Additional options, for internal needs:
     *
     * - `chunkSize` - size of generated data chunks (16K by default)
     * - `raw` (Boolean) - do raw deflate
     * - `gzip` (Boolean) - create gzip wrapper
     * - `to` (String) - if equal to 'string', then result will be "binary string"
     *    (each char code [0..255])
     * - `header` (Object) - custom header for gzip
     *   - `text` (Boolean) - true if compressed data believed to be text
     *   - `time` (Number) - modification time, unix timestamp
     *   - `os` (Number) - operation system code
     *   - `extra` (Array) - array of bytes with extra data (max 65536)
     *   - `name` (String) - file name (binary string)
     *   - `comment` (String) - comment (binary string)
     *   - `hcrc` (Boolean) - true if header crc should be added
     *
     * ##### Example:
     *
     * ```javascript
     * var pako = require('pako')
     *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
     *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
     *
     * var deflate = new pako.Deflate({ level: 3});
     *
     * deflate.push(chunk1, false);
     * deflate.push(chunk2, true);  // true -> last chunk
     *
     * if (deflate.err) { throw new Error(deflate.err); }
     *
     * console.log(deflate.result);
     * ```
     **/
    function Deflate(options) {
        if (!(this instanceof Deflate)) return new Deflate(options)

        this.options = common.assign(
            {
                level: Z_DEFAULT_COMPRESSION$1,
                method: Z_DEFLATED$1,
                chunkSize: 16384,
                windowBits: 15,
                memLevel: 8,
                strategy: Z_DEFAULT_STRATEGY$1,
                to: ''
            },
            options || {}
        )

        var opt = this.options

        if (opt.raw && opt.windowBits > 0) {
            opt.windowBits = -opt.windowBits
        } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
            opt.windowBits += 16
        }

        this.err = 0 // error code, if happens (0 = Z_OK)
        this.msg = '' // error message
        this.ended = false // used to avoid multiple onEnd() calls
        this.chunks = [] // chunks of compressed data

        this.strm = new zstream()
        this.strm.avail_out = 0

        var status = deflate_1.deflateInit2(
            this.strm,
            opt.level,
            opt.method,
            opt.windowBits,
            opt.memLevel,
            opt.strategy
        )

        if (status !== Z_OK$1) {
            throw new Error(messages[status])
        }

        if (opt.header) {
            deflate_1.deflateSetHeader(this.strm, opt.header)
        }

        if (opt.dictionary) {
            var dict
            // Convert data if needed
            if (typeof opt.dictionary === 'string') {
                // If we need to compress text, change encoding to utf8.
                dict = strings.string2buf(opt.dictionary)
            } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
                dict = new Uint8Array(opt.dictionary)
            } else {
                dict = opt.dictionary
            }

            status = deflate_1.deflateSetDictionary(this.strm, dict)

            if (status !== Z_OK$1) {
                throw new Error(messages[status])
            }

            this._dict_set = true
        }
    }

    /**
     * Deflate#push(data[, mode]) -> Boolean
     * - data (Uint8Array|Array|ArrayBuffer|String): input data. Strings will be
     *   converted to utf8 byte sequence.
     * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
     *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
     *
     * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
     * new compressed chunks. Returns `true` on success. The last data block must have
     * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
     * [[Deflate#onEnd]]. For interim explicit flushes (without ending the stream) you
     * can use mode Z_SYNC_FLUSH, keeping the compression context.
     *
     * On fail call [[Deflate#onEnd]] with error code and return false.
     *
     * We strongly recommend to use `Uint8Array` on input for best speed (output
     * array format is detected automatically). Also, don't skip last param and always
     * use the same type in your code (boolean or number). That will improve JS speed.
     *
     * For regular `Array`-s make sure all elements are [0..255].
     *
     * ##### Example
     *
     * ```javascript
     * push(chunk, false); // push one of data chunks
     * ...
     * push(chunk, true);  // push last chunk
     * ```
     **/
    Deflate.prototype.push = function (data, mode) {
        var strm = this.strm
        var chunkSize = this.options.chunkSize
        var status, _mode

        if (this.ended) {
            return false
        }

        _mode = mode === ~~mode ? mode : mode === true ? Z_FINISH$1 : Z_NO_FLUSH$1

        // Convert data if needed
        if (typeof data === 'string') {
            // If we need to compress text, change encoding to utf8.
            strm.input = strings.string2buf(data)
        } else if (toString.call(data) === '[object ArrayBuffer]') {
            strm.input = new Uint8Array(data)
        } else {
            strm.input = data
        }

        strm.next_in = 0
        strm.avail_in = strm.input.length

        do {
            if (strm.avail_out === 0) {
                strm.output = new common.Buf8(chunkSize)
                strm.next_out = 0
                strm.avail_out = chunkSize
            }
            status = deflate_1.deflate(strm, _mode) /* no bad return value */

            if (status !== Z_STREAM_END$1 && status !== Z_OK$1) {
                this.onEnd(status)
                this.ended = true
                return false
            }
            if (strm.avail_out === 0 || (strm.avail_in === 0 && (_mode === Z_FINISH$1 || _mode === Z_SYNC_FLUSH))) {
                if (this.options.to === 'string') {
                    this.onData(strings.buf2binstring(common.shrinkBuf(strm.output, strm.next_out)))
                } else {
                    this.onData(common.shrinkBuf(strm.output, strm.next_out))
                }
            }
        } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END$1)

        // Finalize on the last chunk.
        if (_mode === Z_FINISH$1) {
            status = deflate_1.deflateEnd(this.strm)
            this.onEnd(status)
            this.ended = true
            return status === Z_OK$1
        }

        // callback interim results if Z_SYNC_FLUSH.
        if (_mode === Z_SYNC_FLUSH) {
            this.onEnd(Z_OK$1)
            strm.avail_out = 0
            return true
        }

        return true
    }

    /**
     * Deflate#onData(chunk) -> Void
     * - chunk (Uint8Array|Array|String): output data. Type of array depends
     *   on js engine support. When string output requested, each chunk
     *   will be string.
     *
     * By default, stores data blocks in `chunks[]` property and glue
     * those in `onEnd`. Override this handler, if you need another behaviour.
     **/
    Deflate.prototype.onData = function (chunk) {
        this.chunks.push(chunk)
    }

    /**
     * Deflate#onEnd(status) -> Void
     * - status (Number): deflate status. 0 (Z_OK) on success,
     *   other if not.
     *
     * Called once after you tell deflate that the input stream is
     * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
     * or if an error happened. By default - join collected chunks,
     * free memory and fill `results` / `err` properties.
     **/
    Deflate.prototype.onEnd = function (status) {
        // On success - join
        if (status === Z_OK$1) {
            if (this.options.to === 'string') {
                this.result = this.chunks.join('')
            } else {
                this.result = common.flattenChunks(this.chunks)
            }
        }
        this.chunks = []
        this.err = status
        this.msg = this.strm.msg
    }

    /**
     * deflate(data[, options]) -> Uint8Array|Array|String
     * - data (Uint8Array|Array|String): input data to compress.
     * - options (Object): zlib deflate options.
     *
     * Compress `data` with deflate algorithm and `options`.
     *
     * Supported options are:
     *
     * - level
     * - windowBits
     * - memLevel
     * - strategy
     * - dictionary
     *
     * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
     * for more information on these.
     *
     * Sugar (options):
     *
     * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
     *   negative windowBits implicitly.
     * - `to` (String) - if equal to 'string', then result will be "binary string"
     *    (each char code [0..255])
     *
     * ##### Example:
     *
     * ```javascript
     * var pako = require('pako')
     *   , data = Uint8Array([1,2,3,4,5,6,7,8,9]);
     *
     * console.log(pako.deflate(data));
     * ```
     **/
    function deflate$1(input, options) {
        var deflator = new Deflate(options)

        deflator.push(input, true)

        // That will never happens, if you don't cheat with options :)
        if (deflator.err) {
            throw deflator.msg || messages[deflator.err]
        }

        return deflator.result
    }

    /**
     * deflateRaw(data[, options]) -> Uint8Array|Array|String
     * - data (Uint8Array|Array|String): input data to compress.
     * - options (Object): zlib deflate options.
     *
     * The same as [[deflate]], but creates raw data, without wrapper
     * (header and adler32 crc).
     **/
    function deflateRaw(input, options) {
        options = options || {}
        options.raw = true
        return deflate$1(input, options)
    }

    /**
     * gzip(data[, options]) -> Uint8Array|Array|String
     * - data (Uint8Array|Array|String): input data to compress.
     * - options (Object): zlib deflate options.
     *
     * The same as [[deflate]], but create gzip wrapper instead of
     * deflate one.
     **/
    function gzip(input, options) {
        options = options || {}
        options.gzip = true
        return deflate$1(input, options)
    }

    var Deflate_1 = Deflate
    var deflate_2$1 = deflate$1
    var deflateRaw_1 = deflateRaw
    var gzip_1 = gzip

    var deflate_1$1 = {
        Deflate: Deflate_1,
        deflate: deflate_2$1,
        deflateRaw: deflateRaw_1,
        gzip: gzip_1
    }

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    // See state defs from inflate.js
    var BAD = 30 /* got a data error -- remain here until reset */
    var TYPE = 12 /* i: waiting for type bits, including last-flag bit */

    /*
       Decode literal, length, and distance codes and write out the resulting
       literal and match bytes until either not enough input or output is
       available, an end-of-block is encountered, or a data error is encountered.
       When large enough input and output buffers are supplied to inflate(), for
       example, a 16K input buffer and a 64K output buffer, more than 95% of the
       inflate execution time is spent in this routine.

       Entry assumptions:

            state.mode === LEN
            strm.avail_in >= 6
            strm.avail_out >= 258
            start >= strm.avail_out
            state.bits < 8

       On return, state.mode is one of:

            LEN -- ran out of enough output space or enough available input
            TYPE -- reached end of block code, inflate() to interpret next block
            BAD -- error in block data

       Notes:

        - The maximum input bits used by a length/distance pair is 15 bits for the
          length code, 5 bits for the length extra, 15 bits for the distance code,
          and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
          Therefore if strm.avail_in >= 6, then there is enough input to avoid
          checking for available input while decoding.

        - The maximum bytes that a single length/distance pair can output is 258
          bytes, which is the maximum length that can be coded.  inflate_fast()
          requires strm.avail_out >= 258 for each loop to avoid checking for
          output space.
     */
    var inffast = function inflate_fast(strm, start) {
        var state
        var _in /* local strm.input */
        var last /* have enough input while in < last */
        var _out /* local strm.output */
        var beg /* inflate()'s initial strm.output */
        var end /* while out < end, enough space available */
        //#ifdef INFLATE_STRICT
        var dmax /* maximum distance from zlib header */
        //#endif
        var wsize /* window size or zero if not using window */
        var whave /* valid bytes in the window */
        var wnext /* window write index */
        // Use `s_window` instead `window`, avoid conflict with instrumentation tools
        var s_window /* allocated sliding window, if wsize != 0 */
        var hold /* local strm.hold */
        var bits /* local strm.bits */
        var lcode /* local strm.lencode */
        var dcode /* local strm.distcode */
        var lmask /* mask for first level of length codes */
        var dmask /* mask for first level of distance codes */
        var here /* retrieved table entry */
        var op /* code bits, operation, extra bits, or */
        /*  window position, window bytes to copy */
        var len /* match length, unused bytes */
        var dist /* match distance */
        var from /* where to copy match from */
        var from_source

        var input, output // JS specific, because we have no pointers

        /* copy state to local variables */
        state = strm.state
        //here = state.here;
        _in = strm.next_in
        input = strm.input
        last = _in + (strm.avail_in - 5)
        _out = strm.next_out
        output = strm.output
        beg = _out - (start - strm.avail_out)
        end = _out + (strm.avail_out - 257)
        //#ifdef INFLATE_STRICT
        dmax = state.dmax
        //#endif
        wsize = state.wsize
        whave = state.whave
        wnext = state.wnext
        s_window = state.window
        hold = state.hold
        bits = state.bits
        lcode = state.lencode
        dcode = state.distcode
        lmask = (1 << state.lenbits) - 1
        dmask = (1 << state.distbits) - 1

        /* decode literals and length/distances until end-of-block or not enough
         input data or output space */

        top: do {
            if (bits < 15) {
                hold += input[_in++] << bits
                bits += 8
                hold += input[_in++] << bits
                bits += 8
            }

            here = lcode[hold & lmask]

            dolen: for (;;) {
                // Goto emulation
                op = here >>> 24 /*here.bits*/
                hold >>>= op
                bits -= op
                op = (here >>> 16) & 0xff /*here.op*/
                if (op === 0) {
                    /* literal */
                    //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
                    //        "inflate:         literal '%c'\n" :
                    //        "inflate:         literal 0x%02x\n", here.val));
                    output[_out++] = here & 0xffff /*here.val*/
                } else if (op & 16) {
                    /* length base */
                    len = here & 0xffff /*here.val*/
                    op &= 15 /* number of extra bits */
                    if (op) {
                        if (bits < op) {
                            hold += input[_in++] << bits
                            bits += 8
                        }
                        len += hold & ((1 << op) - 1)
                        hold >>>= op
                        bits -= op
                    }
                    //Tracevv((stderr, "inflate:         length %u\n", len));
                    if (bits < 15) {
                        hold += input[_in++] << bits
                        bits += 8
                        hold += input[_in++] << bits
                        bits += 8
                    }
                    here = dcode[hold & dmask]

                    dodist: for (;;) {
                        // goto emulation
                        op = here >>> 24 /*here.bits*/
                        hold >>>= op
                        bits -= op
                        op = (here >>> 16) & 0xff /*here.op*/

                        if (op & 16) {
                            /* distance base */
                            dist = here & 0xffff /*here.val*/
                            op &= 15 /* number of extra bits */
                            if (bits < op) {
                                hold += input[_in++] << bits
                                bits += 8
                                if (bits < op) {
                                    hold += input[_in++] << bits
                                    bits += 8
                                }
                            }
                            dist += hold & ((1 << op) - 1)
                            //#ifdef INFLATE_STRICT
                            if (dist > dmax) {
                                strm.msg = 'invalid distance too far back'
                                state.mode = BAD
                                break top
                            }
                            //#endif
                            hold >>>= op
                            bits -= op
                            //Tracevv((stderr, "inflate:         distance %u\n", dist));
                            op = _out - beg /* max distance in output */
                            if (dist > op) {
                                /* see if copy from window */
                                op = dist - op /* distance back in window */
                                if (op > whave) {
                                    if (state.sane) {
                                        strm.msg = 'invalid distance too far back'
                                        state.mode = BAD
                                        break top
                                    }

                                    // (!) This block is disabled in zlib defaults,
                                    // don't enable it for binary compatibility
                                    //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
                                    //                if (len <= op - whave) {
                                    //                  do {
                                    //                    output[_out++] = 0;
                                    //                  } while (--len);
                                    //                  continue top;
                                    //                }
                                    //                len -= op - whave;
                                    //                do {
                                    //                  output[_out++] = 0;
                                    //                } while (--op > whave);
                                    //                if (op === 0) {
                                    //                  from = _out - dist;
                                    //                  do {
                                    //                    output[_out++] = output[from++];
                                    //                  } while (--len);
                                    //                  continue top;
                                    //                }
                                    //#endif
                                }
                                from = 0 // window index
                                from_source = s_window
                                if (wnext === 0) {
                                    /* very common case */
                                    from += wsize - op
                                    if (op < len) {
                                        /* some from window */
                                        len -= op
                                        do {
                                            output[_out++] = s_window[from++]
                                        } while (--op)
                                        from = _out - dist /* rest from output */
                                        from_source = output
                                    }
                                } else if (wnext < op) {
                                    /* wrap around window */
                                    from += wsize + wnext - op
                                    op -= wnext
                                    if (op < len) {
                                        /* some from end of window */
                                        len -= op
                                        do {
                                            output[_out++] = s_window[from++]
                                        } while (--op)
                                        from = 0
                                        if (wnext < len) {
                                            /* some from start of window */
                                            op = wnext
                                            len -= op
                                            do {
                                                output[_out++] = s_window[from++]
                                            } while (--op)
                                            from = _out - dist /* rest from output */
                                            from_source = output
                                        }
                                    }
                                } else {
                                    /* contiguous in window */
                                    from += wnext - op
                                    if (op < len) {
                                        /* some from window */
                                        len -= op
                                        do {
                                            output[_out++] = s_window[from++]
                                        } while (--op)
                                        from = _out - dist /* rest from output */
                                        from_source = output
                                    }
                                }
                                while (len > 2) {
                                    output[_out++] = from_source[from++]
                                    output[_out++] = from_source[from++]
                                    output[_out++] = from_source[from++]
                                    len -= 3
                                }
                                if (len) {
                                    output[_out++] = from_source[from++]
                                    if (len > 1) {
                                        output[_out++] = from_source[from++]
                                    }
                                }
                            } else {
                                from = _out - dist /* copy direct from output */
                                do {
                                    /* minimum length is three */
                                    output[_out++] = output[from++]
                                    output[_out++] = output[from++]
                                    output[_out++] = output[from++]
                                    len -= 3
                                } while (len > 2)
                                if (len) {
                                    output[_out++] = output[from++]
                                    if (len > 1) {
                                        output[_out++] = output[from++]
                                    }
                                }
                            }
                        } else if ((op & 64) === 0) {
                            /* 2nd level distance code */
                            here = dcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
                            continue dodist
                        } else {
                            strm.msg = 'invalid distance code'
                            state.mode = BAD
                            break top
                        }

                        break // need to emulate goto via "continue"
                    }
                } else if ((op & 64) === 0) {
                    /* 2nd level length code */
                    here = lcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
                    continue dolen
                } else if (op & 32) {
                    /* end-of-block */
                    //Tracevv((stderr, "inflate:         end of block\n"));
                    state.mode = TYPE
                    break top
                } else {
                    strm.msg = 'invalid literal/length code'
                    state.mode = BAD
                    break top
                }

                break // need to emulate goto via "continue"
            }
        } while (_in < last && _out < end)

        /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
        len = bits >> 3
        _in -= len
        bits -= len << 3
        hold &= (1 << bits) - 1

        /* update state and return */
        strm.next_in = _in
        strm.next_out = _out
        strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last)
        strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end)
        state.hold = hold
        state.bits = bits
        return
    }

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    var MAXBITS = 15
    var ENOUGH_LENS = 852
    var ENOUGH_DISTS = 592
    //var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

    var CODES = 0
    var LENS = 1
    var DISTS = 2

    var lbase = [
        /* Length codes 257..285 base */ 3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        13,
        15,
        17,
        19,
        23,
        27,
        31,
        35,
        43,
        51,
        59,
        67,
        83,
        99,
        115,
        131,
        163,
        195,
        227,
        258,
        0,
        0
    ]

    var lext = [
        /* Length codes 257..285 extra */ 16,
        16,
        16,
        16,
        16,
        16,
        16,
        16,
        17,
        17,
        17,
        17,
        18,
        18,
        18,
        18,
        19,
        19,
        19,
        19,
        20,
        20,
        20,
        20,
        21,
        21,
        21,
        21,
        16,
        72,
        78
    ]

    var dbase = [
        /* Distance codes 0..29 base */ 1,
        2,
        3,
        4,
        5,
        7,
        9,
        13,
        17,
        25,
        33,
        49,
        65,
        97,
        129,
        193,
        257,
        385,
        513,
        769,
        1025,
        1537,
        2049,
        3073,
        4097,
        6145,
        8193,
        12289,
        16385,
        24577,
        0,
        0
    ]

    var dext = [
        /* Distance codes 0..29 extra */ 16,
        16,
        16,
        16,
        17,
        17,
        18,
        18,
        19,
        19,
        20,
        20,
        21,
        21,
        22,
        22,
        23,
        23,
        24,
        24,
        25,
        25,
        26,
        26,
        27,
        27,
        28,
        28,
        29,
        29,
        64,
        64
    ]

    var inftrees = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
        var bits = opts.bits
        //here = opts.here; /* table entry for duplication */

        var len = 0 /* a code's length in bits */
        var sym = 0 /* index of code symbols */
        var min = 0,
            max = 0 /* minimum and maximum code lengths */
        var root = 0 /* number of index bits for root table */
        var curr = 0 /* number of index bits for current table */
        var drop = 0 /* code bits to drop for sub-table */
        var left = 0 /* number of prefix codes available */
        var used = 0 /* code entries in table used */
        var huff = 0 /* Huffman code */
        var incr /* for incrementing code, index */
        var fill /* index for replicating entries */
        var low /* low bits for current root entry */
        var mask /* mask for low root bits */
        var next /* next available space in table */
        var base = null /* base value table to use */
        var base_index = 0
        //  var shoextra;    /* extra bits table to use */
        var end /* use base and extra for symbol > end */
        var count = new common.Buf16(MAXBITS + 1) //[MAXBITS+1];    /* number of codes of each length */
        var offs = new common.Buf16(MAXBITS + 1) //[MAXBITS+1];     /* offsets in table for each length */
        var extra = null
        var extra_index = 0

        var here_bits, here_op, here_val

        /*
       Process a set of code lengths to create a canonical Huffman code.  The
       code lengths are lens[0..codes-1].  Each length corresponds to the
       symbols 0..codes-1.  The Huffman code is generated by first sorting the
       symbols by length from short to long, and retaining the symbol order
       for codes with equal lengths.  Then the code starts with all zero bits
       for the first code of the shortest length, and the codes are integer
       increments for the same length, and zeros are appended as the length
       increases.  For the deflate format, these bits are stored backwards
       from their more natural integer increment ordering, and so when the
       decoding tables are built in the large loop below, the integer codes
       are incremented backwards.

       This routine assumes, but does not check, that all of the entries in
       lens[] are in the range 0..MAXBITS.  The caller must assure this.
       1..MAXBITS is interpreted as that code length.  zero means that that
       symbol does not occur in this code.

       The codes are sorted by computing a count of codes for each length,
       creating from that a table of starting indices for each length in the
       sorted table, and then entering the symbols in order in the sorted
       table.  The sorted table is work[], with that space being provided by
       the caller.

       The length counts are used for other purposes as well, i.e. finding
       the minimum and maximum length codes, determining if there are any
       codes at all, checking for a valid set of lengths, and looking ahead
       at length counts to determine sub-table sizes when building the
       decoding tables.
       */

        /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
        for (len = 0; len <= MAXBITS; len++) {
            count[len] = 0
        }
        for (sym = 0; sym < codes; sym++) {
            count[lens[lens_index + sym]]++
        }

        /* bound code lengths, force root to be within code lengths */
        root = bits
        for (max = MAXBITS; max >= 1; max--) {
            if (count[max] !== 0) {
                break
            }
        }
        if (root > max) {
            root = max
        }
        if (max === 0) {
            /* no symbols to code at all */
            //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
            //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
            //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
            table[table_index++] = (1 << 24) | (64 << 16) | 0

            //table.op[opts.table_index] = 64;
            //table.bits[opts.table_index] = 1;
            //table.val[opts.table_index++] = 0;
            table[table_index++] = (1 << 24) | (64 << 16) | 0

            opts.bits = 1
            return 0 /* no symbols, but wait for decoding to report error */
        }
        for (min = 1; min < max; min++) {
            if (count[min] !== 0) {
                break
            }
        }
        if (root < min) {
            root = min
        }

        /* check for an over-subscribed or incomplete set of lengths */
        left = 1
        for (len = 1; len <= MAXBITS; len++) {
            left <<= 1
            left -= count[len]
            if (left < 0) {
                return -1
            } /* over-subscribed */
        }
        if (left > 0 && (type === CODES || max !== 1)) {
            return -1 /* incomplete set */
        }

        /* generate offsets into symbol table for each length for sorting */
        offs[1] = 0
        for (len = 1; len < MAXBITS; len++) {
            offs[len + 1] = offs[len] + count[len]
        }

        /* sort symbols by length, by symbol order within each length */
        for (sym = 0; sym < codes; sym++) {
            if (lens[lens_index + sym] !== 0) {
                work[offs[lens[lens_index + sym]]++] = sym
            }
        }

        /*
       Create and fill in decoding tables.  In this loop, the table being
       filled is at next and has curr index bits.  The code being used is huff
       with length len.  That code is converted to an index by dropping drop
       bits off of the bottom.  For codes where len is less than drop + curr,
       those top drop + curr - len bits are incremented through all values to
       fill the table with replicated entries.

       root is the number of index bits for the root table.  When len exceeds
       root, sub-tables are created pointed to by the root entry with an index
       of the low root bits of huff.  This is saved in low to check for when a
       new sub-table should be started.  drop is zero when the root table is
       being filled, and drop is root when sub-tables are being filled.

       When a new sub-table is needed, it is necessary to look ahead in the
       code lengths to determine what size sub-table is needed.  The length
       counts are used for this, and so count[] is decremented as codes are
       entered in the tables.

       used keeps track of how many table entries have been allocated from the
       provided *table space.  It is checked for LENS and DIST tables against
       the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
       the initial root table size constants.  See the comments in inftrees.h
       for more information.

       sym increments through all symbols, and the loop terminates when
       all codes of length max, i.e. all codes, have been processed.  This
       routine permits incomplete codes, so another loop after this one fills
       in the rest of the decoding tables with invalid code markers.
       */

        /* set up for code type */
        // poor man optimization - use if-else instead of switch,
        // to avoid deopts in old v8
        if (type === CODES) {
            base = extra = work /* dummy value--not used */
            end = 19
        } else if (type === LENS) {
            base = lbase
            base_index -= 257
            extra = lext
            extra_index -= 257
            end = 256
        } else {
            /* DISTS */
            base = dbase
            extra = dext
            end = -1
        }

        /* initialize opts for loop */
        huff = 0 /* starting code */
        sym = 0 /* starting code symbol */
        len = min /* starting code length */
        next = table_index /* current table to fill in */
        curr = root /* current table index bits */
        drop = 0 /* current bits to drop from code for index */
        low = -1 /* trigger new sub-table when len > root */
        used = 1 << root /* use root table entries */
        mask = used - 1 /* mask for comparing low */

        /* check available table space */
        if ((type === LENS && used > ENOUGH_LENS) || (type === DISTS && used > ENOUGH_DISTS)) {
            return 1
        }

        /* process all codes and make table entries */
        for (;;) {
            /* create table entry */
            here_bits = len - drop
            if (work[sym] < end) {
                here_op = 0
                here_val = work[sym]
            } else if (work[sym] > end) {
                here_op = extra[extra_index + work[sym]]
                here_val = base[base_index + work[sym]]
            } else {
                here_op = 32 + 64 /* end of block */
                here_val = 0
            }

            /* replicate for those indices with low len bits equal to huff */
            incr = 1 << (len - drop)
            fill = 1 << curr
            min = fill /* save offset to next table */
            do {
                fill -= incr
                table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val | 0
            } while (fill !== 0)

            /* backwards increment the len-bit code huff */
            incr = 1 << (len - 1)
            while (huff & incr) {
                incr >>= 1
            }
            if (incr !== 0) {
                huff &= incr - 1
                huff += incr
            } else {
                huff = 0
            }

            /* go to next symbol, update count, len */
            sym++
            if (--count[len] === 0) {
                if (len === max) {
                    break
                }
                len = lens[lens_index + work[sym]]
            }

            /* create new sub-table if needed */
            if (len > root && (huff & mask) !== low) {
                /* if first time, transition to sub-tables */
                if (drop === 0) {
                    drop = root
                }

                /* increment past last table */
                next += min /* here min is 1 << curr */

                /* determine length of next table */
                curr = len - drop
                left = 1 << curr
                while (curr + drop < max) {
                    left -= count[curr + drop]
                    if (left <= 0) {
                        break
                    }
                    curr++
                    left <<= 1
                }

                /* check for enough space */
                used += 1 << curr
                if ((type === LENS && used > ENOUGH_LENS) || (type === DISTS && used > ENOUGH_DISTS)) {
                    return 1
                }

                /* point entry in root table to sub-table */
                low = huff & mask
                /*table.op[low] = curr;
          table.bits[low] = root;
          table.val[low] = next - opts.table_index;*/
                table[low] = (root << 24) | (curr << 16) | (next - table_index) | 0
            }
        }

        /* fill in remaining table entry if code is incomplete (guaranteed to have
       at most one remaining entry, since if the code is incomplete, the
       maximum code length that was allowed to get this far is one bit) */
        if (huff !== 0) {
            //table.op[next + huff] = 64;            /* invalid code marker */
            //table.bits[next + huff] = len - drop;
            //table.val[next + huff] = 0;
            table[next + huff] = ((len - drop) << 24) | (64 << 16) | 0
        }

        /* set return parameters */
        //opts.table_index += used;
        opts.bits = root
        return 0
    }

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    var CODES$1 = 0
    var LENS$1 = 1
    var DISTS$1 = 2

    /* Public constants ==========================================================*/
    /* ===========================================================================*/

    /* Allowed flush values; see deflate() and inflate() below for details */
    //var Z_NO_FLUSH      = 0;
    //var Z_PARTIAL_FLUSH = 1;
    //var Z_SYNC_FLUSH    = 2;
    //var Z_FULL_FLUSH    = 3;
    var Z_FINISH$2 = 4
    var Z_BLOCK$1 = 5
    var Z_TREES = 6

    /* Return codes for the compression/decompression functions. Negative values
     * are errors, positive values are used for special but normal events.
     */
    var Z_OK$2 = 0
    var Z_STREAM_END$2 = 1
    var Z_NEED_DICT = 2
    //var Z_ERRNO         = -1;
    var Z_STREAM_ERROR$1 = -2
    var Z_DATA_ERROR$1 = -3
    var Z_MEM_ERROR = -4
    var Z_BUF_ERROR$1 = -5
    //var Z_VERSION_ERROR = -6;

    /* The deflate compression method */
    var Z_DEFLATED$2 = 8

    /* STATES ====================================================================*/
    /* ===========================================================================*/

    var HEAD = 1 /* i: waiting for magic header */
    var FLAGS = 2 /* i: waiting for method and flags (gzip) */
    var TIME = 3 /* i: waiting for modification time (gzip) */
    var OS = 4 /* i: waiting for extra flags and operating system (gzip) */
    var EXLEN = 5 /* i: waiting for extra length (gzip) */
    var EXTRA = 6 /* i: waiting for extra bytes (gzip) */
    var NAME = 7 /* i: waiting for end of file name (gzip) */
    var COMMENT = 8 /* i: waiting for end of comment (gzip) */
    var HCRC = 9 /* i: waiting for header crc (gzip) */
    var DICTID = 10 /* i: waiting for dictionary check value */
    var DICT = 11 /* waiting for inflateSetDictionary() call */
    var TYPE$1 = 12 /* i: waiting for type bits, including last-flag bit */
    var TYPEDO = 13 /* i: same, but skip check to exit inflate on new block */
    var STORED = 14 /* i: waiting for stored size (length and complement) */
    var COPY_ = 15 /* i/o: same as COPY below, but only first time in */
    var COPY = 16 /* i/o: waiting for input or output to copy stored block */
    var TABLE = 17 /* i: waiting for dynamic block table lengths */
    var LENLENS = 18 /* i: waiting for code length code lengths */
    var CODELENS = 19 /* i: waiting for length/lit and distance code lengths */
    var LEN_ = 20 /* i: same as LEN below, but only first time in */
    var LEN = 21 /* i: waiting for length/lit/eob code */
    var LENEXT = 22 /* i: waiting for length extra bits */
    var DIST = 23 /* i: waiting for distance code */
    var DISTEXT = 24 /* i: waiting for distance extra bits */
    var MATCH = 25 /* o: waiting for output space to copy string */
    var LIT = 26 /* o: waiting for output space to write literal */
    var CHECK = 27 /* i: waiting for 32-bit check value */
    var LENGTH = 28 /* i: waiting for 32-bit length (gzip) */
    var DONE = 29 /* finished check, done -- remain here until reset */
    var BAD$1 = 30 /* got a data error -- remain here until reset */
    var MEM = 31 /* got an inflate() memory error -- remain here until reset */
    var SYNC = 32 /* looking for synchronization bytes to restart inflate() */

    /* ===========================================================================*/

    var ENOUGH_LENS$1 = 852
    var ENOUGH_DISTS$1 = 592
    //var ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

    var MAX_WBITS$1 = 15
    /* 32K LZ77 window */
    var DEF_WBITS = MAX_WBITS$1

    function zswap32(q) {
        return ((q >>> 24) & 0xff) + ((q >>> 8) & 0xff00) + ((q & 0xff00) << 8) + ((q & 0xff) << 24)
    }

    function InflateState() {
        this.mode = 0 /* current inflate mode */
        this.last = false /* true if processing last block */
        this.wrap = 0 /* bit 0 true for zlib, bit 1 true for gzip */
        this.havedict = false /* true if dictionary provided */
        this.flags = 0 /* gzip header method and flags (0 if zlib) */
        this.dmax = 0 /* zlib header max distance (INFLATE_STRICT) */
        this.check = 0 /* protected copy of check value */
        this.total = 0 /* protected copy of output count */
        // TODO: may be {}
        this.head = null /* where to save gzip header information */

        /* sliding window */
        this.wbits = 0 /* log base 2 of requested window size */
        this.wsize = 0 /* window size or zero if not using window */
        this.whave = 0 /* valid bytes in the window */
        this.wnext = 0 /* window write index */
        this.window = null /* allocated sliding window, if needed */

        /* bit accumulator */
        this.hold = 0 /* input bit accumulator */
        this.bits = 0 /* number of bits in "in" */

        /* for string and stored block copying */
        this.length = 0 /* literal or length of data to copy */
        this.offset = 0 /* distance back to copy string from */

        /* for table and code decoding */
        this.extra = 0 /* extra bits needed */

        /* fixed and dynamic code tables */
        this.lencode = null /* starting table for length/literal codes */
        this.distcode = null /* starting table for distance codes */
        this.lenbits = 0 /* index bits for lencode */
        this.distbits = 0 /* index bits for distcode */

        /* dynamic table building */
        this.ncode = 0 /* number of code length code lengths */
        this.nlen = 0 /* number of length code lengths */
        this.ndist = 0 /* number of distance code lengths */
        this.have = 0 /* number of code lengths in lens[] */
        this.next = null /* next available space in codes[] */

        this.lens = new common.Buf16(320) /* temporary storage for code lengths */
        this.work = new common.Buf16(288) /* work area for code table building */

        /*
       because we don't have pointers in js, we use lencode and distcode directly
       as buffers so we don't need codes
      */
        //this.codes = new utils.Buf32(ENOUGH);       /* space for code tables */
        this.lendyn = null /* dynamic table for length/literal codes (JS specific) */
        this.distdyn = null /* dynamic table for distance codes (JS specific) */
        this.sane = 0 /* if false, allow invalid distance too far */
        this.back = 0 /* bits back of last unprocessed length/lit */
        this.was = 0 /* initial length of match */
    }

    function inflateResetKeep(strm) {
        var state

        if (!strm || !strm.state) {
            return Z_STREAM_ERROR$1
        }
        state = strm.state
        strm.total_in = strm.total_out = state.total = 0
        strm.msg = '' /*Z_NULL*/
        if (state.wrap) {
            /* to support ill-conceived Java test suite */
            strm.adler = state.wrap & 1
        }
        state.mode = HEAD
        state.last = 0
        state.havedict = 0
        state.dmax = 32768
        state.head = null /*Z_NULL*/
        state.hold = 0
        state.bits = 0
        //state.lencode = state.distcode = state.next = state.codes;
        state.lencode = state.lendyn = new common.Buf32(ENOUGH_LENS$1)
        state.distcode = state.distdyn = new common.Buf32(ENOUGH_DISTS$1)

        state.sane = 1
        state.back = -1
        //Tracev((stderr, "inflate: reset\n"));
        return Z_OK$2
    }

    function inflateReset(strm) {
        var state

        if (!strm || !strm.state) {
            return Z_STREAM_ERROR$1
        }
        state = strm.state
        state.wsize = 0
        state.whave = 0
        state.wnext = 0
        return inflateResetKeep(strm)
    }

    function inflateReset2(strm, windowBits) {
        var wrap
        var state

        /* get the state */
        if (!strm || !strm.state) {
            return Z_STREAM_ERROR$1
        }
        state = strm.state

        /* extract wrap request from windowBits parameter */
        if (windowBits < 0) {
            wrap = 0
            windowBits = -windowBits
        } else {
            wrap = (windowBits >> 4) + 1
            if (windowBits < 48) {
                windowBits &= 15
            }
        }

        /* set number of window bits, free window if different */
        if (windowBits && (windowBits < 8 || windowBits > 15)) {
            return Z_STREAM_ERROR$1
        }
        if (state.window !== null && state.wbits !== windowBits) {
            state.window = null
        }

        /* update state and reset the rest of it */
        state.wrap = wrap
        state.wbits = windowBits
        return inflateReset(strm)
    }

    function inflateInit2(strm, windowBits) {
        var ret
        var state

        if (!strm) {
            return Z_STREAM_ERROR$1
        }
        //strm.msg = Z_NULL;                 /* in case we return an error */

        state = new InflateState()

        //if (state === Z_NULL) return Z_MEM_ERROR;
        //Tracev((stderr, "inflate: allocated\n"));
        strm.state = state
        state.window = null /*Z_NULL*/
        ret = inflateReset2(strm, windowBits)
        if (ret !== Z_OK$2) {
            strm.state = null /*Z_NULL*/
        }
        return ret
    }

    function inflateInit(strm) {
        return inflateInit2(strm, DEF_WBITS)
    }

    /*
     Return state with length and distance decoding tables and index sizes set to
     fixed code decoding.  Normally this returns fixed tables from inffixed.h.
     If BUILDFIXED is defined, then instead this routine builds the tables the
     first time it's called, and returns those tables the first time and
     thereafter.  This reduces the size of the code by about 2K bytes, in
     exchange for a little execution time.  However, BUILDFIXED should not be
     used for threaded applications, since the rewriting of the tables and virgin
     may not be thread-safe.
     */
    var virgin = true

    var lenfix, distfix // We have no pointers in JS, so keep tables separate

    function fixedtables(state) {
        /* build fixed huffman tables if first call (may not be thread safe) */
        if (virgin) {
            var sym

            lenfix = new common.Buf32(512)
            distfix = new common.Buf32(32)

            /* literal/length table */
            sym = 0
            while (sym < 144) {
                state.lens[sym++] = 8
            }
            while (sym < 256) {
                state.lens[sym++] = 9
            }
            while (sym < 280) {
                state.lens[sym++] = 7
            }
            while (sym < 288) {
                state.lens[sym++] = 8
            }

            inftrees(LENS$1, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 })

            /* distance table */
            sym = 0
            while (sym < 32) {
                state.lens[sym++] = 5
            }

            inftrees(DISTS$1, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 })

            /* do this just once */
            virgin = false
        }

        state.lencode = lenfix
        state.lenbits = 9
        state.distcode = distfix
        state.distbits = 5
    }

    /*
     Update the window with the last wsize (normally 32K) bytes written before
     returning.  If window does not exist yet, create it.  This is only called
     when a window is already in use, or when output has been written during this
     inflate call, but the end of the deflate stream has not been reached yet.
     It is also called to create a window for dictionary data when a dictionary
     is loaded.

     Providing output buffers larger than 32K to inflate() should provide a speed
     advantage, since only the last 32K of output is copied to the sliding window
     upon return from inflate(), and since all distances after the first 32K of
     output will fall in the output data, making match copies simpler and faster.
     The advantage may be dependent on the size of the processor's data caches.
     */
    function updatewindow(strm, src, end, copy) {
        var dist
        var state = strm.state

        /* if it hasn't been done already, allocate space for the window */
        if (state.window === null) {
            state.wsize = 1 << state.wbits
            state.wnext = 0
            state.whave = 0

            state.window = new common.Buf8(state.wsize)
        }

        /* copy state->wsize or less output bytes into the circular window */
        if (copy >= state.wsize) {
            common.arraySet(state.window, src, end - state.wsize, state.wsize, 0)
            state.wnext = 0
            state.whave = state.wsize
        } else {
            dist = state.wsize - state.wnext
            if (dist > copy) {
                dist = copy
            }
            //zmemcpy(state->window + state->wnext, end - copy, dist);
            common.arraySet(state.window, src, end - copy, dist, state.wnext)
            copy -= dist
            if (copy) {
                //zmemcpy(state->window, end - copy, copy);
                common.arraySet(state.window, src, end - copy, copy, 0)
                state.wnext = copy
                state.whave = state.wsize
            } else {
                state.wnext += dist
                if (state.wnext === state.wsize) {
                    state.wnext = 0
                }
                if (state.whave < state.wsize) {
                    state.whave += dist
                }
            }
        }
        return 0
    }

    function inflate(strm, flush) {
        var state
        var input, output // input/output buffers
        var next /* next input INDEX */
        var put /* next output INDEX */
        var have, left /* available input and output */
        var hold /* bit buffer */
        var bits /* bits in bit buffer */
        var _in, _out /* save starting available input and output */
        var copy /* number of stored or match bytes to copy */
        var from /* where to copy match bytes from */
        var from_source
        var here = 0 /* current decoding table entry */
        var here_bits, here_op, here_val // paked "here" denormalized (JS specific)
        //var last;                   /* parent table entry */
        var last_bits, last_op, last_val // paked "last" denormalized (JS specific)
        var len /* length to copy for repeats, bits to drop */
        var ret /* return code */
        var hbuf = new common.Buf8(4) /* buffer for gzip header crc calculation */
        var opts

        var n // temporary var for NEED_BITS

        var order = /* permutation of code lengths */ [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

        if (!strm || !strm.state || !strm.output || (!strm.input && strm.avail_in !== 0)) {
            return Z_STREAM_ERROR$1
        }

        state = strm.state
        if (state.mode === TYPE$1) {
            state.mode = TYPEDO
        } /* skip check */

        //--- LOAD() ---
        put = strm.next_out
        output = strm.output
        left = strm.avail_out
        next = strm.next_in
        input = strm.input
        have = strm.avail_in
        hold = state.hold
        bits = state.bits
        //---

        _in = have
        _out = left
        ret = Z_OK$2

        // goto emulation
        inf_leave: for (;;) {
            switch (state.mode) {
                case HEAD:
                    if (state.wrap === 0) {
                        state.mode = TYPEDO
                        break
                    }
                    //=== NEEDBITS(16);
                    while (bits < 16) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    if (state.wrap & 2 && hold === 0x8b1f) {
                        /* gzip header */
                        state.check = 0 /*crc32(0L, Z_NULL, 0)*/
                        //=== CRC2(state.check, hold);
                        hbuf[0] = hold & 0xff
                        hbuf[1] = (hold >>> 8) & 0xff
                        state.check = crc32_1(state.check, hbuf, 2, 0)
                        //===//

                        //=== INITBITS();
                        hold = 0
                        bits = 0
                        //===//
                        state.mode = FLAGS
                        break
                    }
                    state.flags = 0 /* expect zlib header */
                    if (state.head) {
                        state.head.done = false
                    }
                    if (
                        !(state.wrap & 1) /* check if zlib header allowed */ ||
                        (((hold & 0xff) /*BITS(8)*/ << 8) + (hold >> 8)) % 31
                    ) {
                        strm.msg = 'incorrect header check'
                        state.mode = BAD$1
                        break
                    }
                    if ((hold & 0x0f) /*BITS(4)*/ !== Z_DEFLATED$2) {
                        strm.msg = 'unknown compression method'
                        state.mode = BAD$1
                        break
                    }
                    //--- DROPBITS(4) ---//
                    hold >>>= 4
                    bits -= 4
                    //---//
                    len = (hold & 0x0f) /*BITS(4)*/ + 8
                    if (state.wbits === 0) {
                        state.wbits = len
                    } else if (len > state.wbits) {
                        strm.msg = 'invalid window size'
                        state.mode = BAD$1
                        break
                    }
                    state.dmax = 1 << len
                    //Tracev((stderr, "inflate:   zlib header ok\n"));
                    strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
                    state.mode = hold & 0x200 ? DICTID : TYPE$1
                    //=== INITBITS();
                    hold = 0
                    bits = 0
                    //===//
                    break
                case FLAGS:
                    //=== NEEDBITS(16); */
                    while (bits < 16) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    state.flags = hold
                    if ((state.flags & 0xff) !== Z_DEFLATED$2) {
                        strm.msg = 'unknown compression method'
                        state.mode = BAD$1
                        break
                    }
                    if (state.flags & 0xe000) {
                        strm.msg = 'unknown header flags set'
                        state.mode = BAD$1
                        break
                    }
                    if (state.head) {
                        state.head.text = (hold >> 8) & 1
                    }
                    if (state.flags & 0x0200) {
                        //=== CRC2(state.check, hold);
                        hbuf[0] = hold & 0xff
                        hbuf[1] = (hold >>> 8) & 0xff
                        state.check = crc32_1(state.check, hbuf, 2, 0)
                        //===//
                    }
                    //=== INITBITS();
                    hold = 0
                    bits = 0
                    //===//
                    state.mode = TIME
                /* falls through */
                case TIME:
                    //=== NEEDBITS(32); */
                    while (bits < 32) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    if (state.head) {
                        state.head.time = hold
                    }
                    if (state.flags & 0x0200) {
                        //=== CRC4(state.check, hold)
                        hbuf[0] = hold & 0xff
                        hbuf[1] = (hold >>> 8) & 0xff
                        hbuf[2] = (hold >>> 16) & 0xff
                        hbuf[3] = (hold >>> 24) & 0xff
                        state.check = crc32_1(state.check, hbuf, 4, 0)
                        //===
                    }
                    //=== INITBITS();
                    hold = 0
                    bits = 0
                    //===//
                    state.mode = OS
                /* falls through */
                case OS:
                    //=== NEEDBITS(16); */
                    while (bits < 16) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    if (state.head) {
                        state.head.xflags = hold & 0xff
                        state.head.os = hold >> 8
                    }
                    if (state.flags & 0x0200) {
                        //=== CRC2(state.check, hold);
                        hbuf[0] = hold & 0xff
                        hbuf[1] = (hold >>> 8) & 0xff
                        state.check = crc32_1(state.check, hbuf, 2, 0)
                        //===//
                    }
                    //=== INITBITS();
                    hold = 0
                    bits = 0
                    //===//
                    state.mode = EXLEN
                /* falls through */
                case EXLEN:
                    if (state.flags & 0x0400) {
                        //=== NEEDBITS(16); */
                        while (bits < 16) {
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                        }
                        //===//
                        state.length = hold
                        if (state.head) {
                            state.head.extra_len = hold
                        }
                        if (state.flags & 0x0200) {
                            //=== CRC2(state.check, hold);
                            hbuf[0] = hold & 0xff
                            hbuf[1] = (hold >>> 8) & 0xff
                            state.check = crc32_1(state.check, hbuf, 2, 0)
                            //===//
                        }
                        //=== INITBITS();
                        hold = 0
                        bits = 0
                        //===//
                    } else if (state.head) {
                        state.head.extra = null /*Z_NULL*/
                    }
                    state.mode = EXTRA
                /* falls through */
                case EXTRA:
                    if (state.flags & 0x0400) {
                        copy = state.length
                        if (copy > have) {
                            copy = have
                        }
                        if (copy) {
                            if (state.head) {
                                len = state.head.extra_len - state.length
                                if (!state.head.extra) {
                                    // Use untyped array for more convenient processing later
                                    state.head.extra = new Array(state.head.extra_len)
                                }
                                common.arraySet(
                                    state.head.extra,
                                    input,
                                    next,
                                    // extra field is limited to 65536 bytes
                                    // - no need for additional size check
                                    copy,
                                    /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                                    len
                                )
                                //zmemcpy(state.head.extra + len, next,
                                //        len + copy > state.head.extra_max ?
                                //        state.head.extra_max - len : copy);
                            }
                            if (state.flags & 0x0200) {
                                state.check = crc32_1(state.check, input, copy, next)
                            }
                            have -= copy
                            next += copy
                            state.length -= copy
                        }
                        if (state.length) {
                            break inf_leave
                        }
                    }
                    state.length = 0
                    state.mode = NAME
                /* falls through */
                case NAME:
                    if (state.flags & 0x0800) {
                        if (have === 0) {
                            break inf_leave
                        }
                        copy = 0
                        do {
                            // TODO: 2 or 1 bytes?
                            len = input[next + copy++]
                            /* use constant limit because in js we should not preallocate memory */
                            if (state.head && len && state.length < 65536 /*state.head.name_max*/) {
                                state.head.name += String.fromCharCode(len)
                            }
                        } while (len && copy < have)

                        if (state.flags & 0x0200) {
                            state.check = crc32_1(state.check, input, copy, next)
                        }
                        have -= copy
                        next += copy
                        if (len) {
                            break inf_leave
                        }
                    } else if (state.head) {
                        state.head.name = null
                    }
                    state.length = 0
                    state.mode = COMMENT
                /* falls through */
                case COMMENT:
                    if (state.flags & 0x1000) {
                        if (have === 0) {
                            break inf_leave
                        }
                        copy = 0
                        do {
                            len = input[next + copy++]
                            /* use constant limit because in js we should not preallocate memory */
                            if (state.head && len && state.length < 65536 /*state.head.comm_max*/) {
                                state.head.comment += String.fromCharCode(len)
                            }
                        } while (len && copy < have)
                        if (state.flags & 0x0200) {
                            state.check = crc32_1(state.check, input, copy, next)
                        }
                        have -= copy
                        next += copy
                        if (len) {
                            break inf_leave
                        }
                    } else if (state.head) {
                        state.head.comment = null
                    }
                    state.mode = HCRC
                /* falls through */
                case HCRC:
                    if (state.flags & 0x0200) {
                        //=== NEEDBITS(16); */
                        while (bits < 16) {
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                        }
                        //===//
                        if (hold !== (state.check & 0xffff)) {
                            strm.msg = 'header crc mismatch'
                            state.mode = BAD$1
                            break
                        }
                        //=== INITBITS();
                        hold = 0
                        bits = 0
                        //===//
                    }
                    if (state.head) {
                        state.head.hcrc = (state.flags >> 9) & 1
                        state.head.done = true
                    }
                    strm.adler = state.check = 0
                    state.mode = TYPE$1
                    break
                case DICTID:
                    //=== NEEDBITS(32); */
                    while (bits < 32) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    strm.adler = state.check = zswap32(hold)
                    //=== INITBITS();
                    hold = 0
                    bits = 0
                    //===//
                    state.mode = DICT
                /* falls through */
                case DICT:
                    if (state.havedict === 0) {
                        //--- RESTORE() ---
                        strm.next_out = put
                        strm.avail_out = left
                        strm.next_in = next
                        strm.avail_in = have
                        state.hold = hold
                        state.bits = bits
                        //---
                        return Z_NEED_DICT
                    }
                    strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
                    state.mode = TYPE$1
                /* falls through */
                case TYPE$1:
                    if (flush === Z_BLOCK$1 || flush === Z_TREES) {
                        break inf_leave
                    }
                /* falls through */
                case TYPEDO:
                    if (state.last) {
                        //--- BYTEBITS() ---//
                        hold >>>= bits & 7
                        bits -= bits & 7
                        //---//
                        state.mode = CHECK
                        break
                    }
                    //=== NEEDBITS(3); */
                    while (bits < 3) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    state.last = hold & 0x01 /*BITS(1)*/
                    //--- DROPBITS(1) ---//
                    hold >>>= 1
                    bits -= 1
                    //---//

                    switch (hold & 0x03 /*BITS(2)*/) {
                        case 0 /* stored block */:
                            //Tracev((stderr, "inflate:     stored block%s\n",
                            //        state.last ? " (last)" : ""));
                            state.mode = STORED
                            break
                        case 1 /* fixed block */:
                            fixedtables(state)
                            //Tracev((stderr, "inflate:     fixed codes block%s\n",
                            //        state.last ? " (last)" : ""));
                            state.mode = LEN_ /* decode codes */
                            if (flush === Z_TREES) {
                                //--- DROPBITS(2) ---//
                                hold >>>= 2
                                bits -= 2
                                //---//
                                break inf_leave
                            }
                            break
                        case 2 /* dynamic block */:
                            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
                            //        state.last ? " (last)" : ""));
                            state.mode = TABLE
                            break
                        case 3:
                            strm.msg = 'invalid block type'
                            state.mode = BAD$1
                    }
                    //--- DROPBITS(2) ---//
                    hold >>>= 2
                    bits -= 2
                    //---//
                    break
                case STORED:
                    //--- BYTEBITS() ---// /* go to byte boundary */
                    hold >>>= bits & 7
                    bits -= bits & 7
                    //---//
                    //=== NEEDBITS(32); */
                    while (bits < 32) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
                        strm.msg = 'invalid stored block lengths'
                        state.mode = BAD$1
                        break
                    }
                    state.length = hold & 0xffff
                    //Tracev((stderr, "inflate:       stored length %u\n",
                    //        state.length));
                    //=== INITBITS();
                    hold = 0
                    bits = 0
                    //===//
                    state.mode = COPY_
                    if (flush === Z_TREES) {
                        break inf_leave
                    }
                /* falls through */
                case COPY_:
                    state.mode = COPY
                /* falls through */
                case COPY:
                    copy = state.length
                    if (copy) {
                        if (copy > have) {
                            copy = have
                        }
                        if (copy > left) {
                            copy = left
                        }
                        if (copy === 0) {
                            break inf_leave
                        }
                        //--- zmemcpy(put, next, copy); ---
                        common.arraySet(output, input, next, copy, put)
                        //---//
                        have -= copy
                        next += copy
                        left -= copy
                        put += copy
                        state.length -= copy
                        break
                    }
                    //Tracev((stderr, "inflate:       stored end\n"));
                    state.mode = TYPE$1
                    break
                case TABLE:
                    //=== NEEDBITS(14); */
                    while (bits < 14) {
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                    }
                    //===//
                    state.nlen = (hold & 0x1f) /*BITS(5)*/ + 257
                    //--- DROPBITS(5) ---//
                    hold >>>= 5
                    bits -= 5
                    //---//
                    state.ndist = (hold & 0x1f) /*BITS(5)*/ + 1
                    //--- DROPBITS(5) ---//
                    hold >>>= 5
                    bits -= 5
                    //---//
                    state.ncode = (hold & 0x0f) /*BITS(4)*/ + 4
                    //--- DROPBITS(4) ---//
                    hold >>>= 4
                    bits -= 4
                    //---//
                    //#ifndef PKZIP_BUG_WORKAROUND
                    if (state.nlen > 286 || state.ndist > 30) {
                        strm.msg = 'too many length or distance symbols'
                        state.mode = BAD$1
                        break
                    }
                    //#endif
                    //Tracev((stderr, "inflate:       table sizes ok\n"));
                    state.have = 0
                    state.mode = LENLENS
                /* falls through */
                case LENLENS:
                    while (state.have < state.ncode) {
                        //=== NEEDBITS(3);
                        while (bits < 3) {
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                        }
                        //===//
                        state.lens[order[state.have++]] = hold & 0x07 //BITS(3);
                        //--- DROPBITS(3) ---//
                        hold >>>= 3
                        bits -= 3
                        //---//
                    }
                    while (state.have < 19) {
                        state.lens[order[state.have++]] = 0
                    }
                    // We have separate tables & no pointers. 2 commented lines below not needed.
                    //state.next = state.codes;
                    //state.lencode = state.next;
                    // Switch to use dynamic table
                    state.lencode = state.lendyn
                    state.lenbits = 7

                    opts = { bits: state.lenbits }
                    ret = inftrees(CODES$1, state.lens, 0, 19, state.lencode, 0, state.work, opts)
                    state.lenbits = opts.bits

                    if (ret) {
                        strm.msg = 'invalid code lengths set'
                        state.mode = BAD$1
                        break
                    }
                    //Tracev((stderr, "inflate:       code lengths ok\n"));
                    state.have = 0
                    state.mode = CODELENS
                /* falls through */
                case CODELENS:
                    while (state.have < state.nlen + state.ndist) {
                        for (;;) {
                            here = state.lencode[hold & ((1 << state.lenbits) - 1)] /*BITS(state.lenbits)*/
                            here_bits = here >>> 24
                            here_op = (here >>> 16) & 0xff
                            here_val = here & 0xffff

                            if (here_bits <= bits) {
                                break
                            }
                            //--- PULLBYTE() ---//
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                            //---//
                        }
                        if (here_val < 16) {
                            //--- DROPBITS(here.bits) ---//
                            hold >>>= here_bits
                            bits -= here_bits
                            //---//
                            state.lens[state.have++] = here_val
                        } else {
                            if (here_val === 16) {
                                //=== NEEDBITS(here.bits + 2);
                                n = here_bits + 2
                                while (bits < n) {
                                    if (have === 0) {
                                        break inf_leave
                                    }
                                    have--
                                    hold += input[next++] << bits
                                    bits += 8
                                }
                                //===//
                                //--- DROPBITS(here.bits) ---//
                                hold >>>= here_bits
                                bits -= here_bits
                                //---//
                                if (state.have === 0) {
                                    strm.msg = 'invalid bit length repeat'
                                    state.mode = BAD$1
                                    break
                                }
                                len = state.lens[state.have - 1]
                                copy = 3 + (hold & 0x03) //BITS(2);
                                //--- DROPBITS(2) ---//
                                hold >>>= 2
                                bits -= 2
                                //---//
                            } else if (here_val === 17) {
                                //=== NEEDBITS(here.bits + 3);
                                n = here_bits + 3
                                while (bits < n) {
                                    if (have === 0) {
                                        break inf_leave
                                    }
                                    have--
                                    hold += input[next++] << bits
                                    bits += 8
                                }
                                //===//
                                //--- DROPBITS(here.bits) ---//
                                hold >>>= here_bits
                                bits -= here_bits
                                //---//
                                len = 0
                                copy = 3 + (hold & 0x07) //BITS(3);
                                //--- DROPBITS(3) ---//
                                hold >>>= 3
                                bits -= 3
                                //---//
                            } else {
                                //=== NEEDBITS(here.bits + 7);
                                n = here_bits + 7
                                while (bits < n) {
                                    if (have === 0) {
                                        break inf_leave
                                    }
                                    have--
                                    hold += input[next++] << bits
                                    bits += 8
                                }
                                //===//
                                //--- DROPBITS(here.bits) ---//
                                hold >>>= here_bits
                                bits -= here_bits
                                //---//
                                len = 0
                                copy = 11 + (hold & 0x7f) //BITS(7);
                                //--- DROPBITS(7) ---//
                                hold >>>= 7
                                bits -= 7
                                //---//
                            }
                            if (state.have + copy > state.nlen + state.ndist) {
                                strm.msg = 'invalid bit length repeat'
                                state.mode = BAD$1
                                break
                            }
                            while (copy--) {
                                state.lens[state.have++] = len
                            }
                        }
                    }

                    /* handle error breaks in while */
                    if (state.mode === BAD$1) {
                        break
                    }

                    /* check for end-of-block code (better have one) */
                    if (state.lens[256] === 0) {
                        strm.msg = 'invalid code -- missing end-of-block'
                        state.mode = BAD$1
                        break
                    }

                    /* build code tables -- note: do not change the lenbits or distbits
               values here (9 and 6) without reading the comments in inftrees.h
               concerning the ENOUGH constants, which depend on those values */
                    state.lenbits = 9

                    opts = { bits: state.lenbits }
                    ret = inftrees(LENS$1, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts)
                    // We have separate tables & no pointers. 2 commented lines below not needed.
                    // state.next_index = opts.table_index;
                    state.lenbits = opts.bits
                    // state.lencode = state.next;

                    if (ret) {
                        strm.msg = 'invalid literal/lengths set'
                        state.mode = BAD$1
                        break
                    }

                    state.distbits = 6
                    //state.distcode.copy(state.codes);
                    // Switch to use dynamic table
                    state.distcode = state.distdyn
                    opts = { bits: state.distbits }
                    ret = inftrees(DISTS$1, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts)
                    // We have separate tables & no pointers. 2 commented lines below not needed.
                    // state.next_index = opts.table_index;
                    state.distbits = opts.bits
                    // state.distcode = state.next;

                    if (ret) {
                        strm.msg = 'invalid distances set'
                        state.mode = BAD$1
                        break
                    }
                    //Tracev((stderr, 'inflate:       codes ok\n'));
                    state.mode = LEN_
                    if (flush === Z_TREES) {
                        break inf_leave
                    }
                /* falls through */
                case LEN_:
                    state.mode = LEN
                /* falls through */
                case LEN:
                    if (have >= 6 && left >= 258) {
                        //--- RESTORE() ---
                        strm.next_out = put
                        strm.avail_out = left
                        strm.next_in = next
                        strm.avail_in = have
                        state.hold = hold
                        state.bits = bits
                        //---
                        inffast(strm, _out)
                        //--- LOAD() ---
                        put = strm.next_out
                        output = strm.output
                        left = strm.avail_out
                        next = strm.next_in
                        input = strm.input
                        have = strm.avail_in
                        hold = state.hold
                        bits = state.bits
                        //---

                        if (state.mode === TYPE$1) {
                            state.back = -1
                        }
                        break
                    }
                    state.back = 0
                    for (;;) {
                        here = state.lencode[hold & ((1 << state.lenbits) - 1)] /*BITS(state.lenbits)*/
                        here_bits = here >>> 24
                        here_op = (here >>> 16) & 0xff
                        here_val = here & 0xffff

                        if (here_bits <= bits) {
                            break
                        }
                        //--- PULLBYTE() ---//
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                        //---//
                    }
                    if (here_op && (here_op & 0xf0) === 0) {
                        last_bits = here_bits
                        last_op = here_op
                        last_val = here_val
                        for (;;) {
                            here =
                                state.lencode[
                                    last_val +
                                        ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >>
                                            last_bits)
                                ]
                            here_bits = here >>> 24
                            here_op = (here >>> 16) & 0xff
                            here_val = here & 0xffff

                            if (last_bits + here_bits <= bits) {
                                break
                            }
                            //--- PULLBYTE() ---//
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                            //---//
                        }
                        //--- DROPBITS(last.bits) ---//
                        hold >>>= last_bits
                        bits -= last_bits
                        //---//
                        state.back += last_bits
                    }
                    //--- DROPBITS(here.bits) ---//
                    hold >>>= here_bits
                    bits -= here_bits
                    //---//
                    state.back += here_bits
                    state.length = here_val
                    if (here_op === 0) {
                        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
                        //        "inflate:         literal '%c'\n" :
                        //        "inflate:         literal 0x%02x\n", here.val));
                        state.mode = LIT
                        break
                    }
                    if (here_op & 32) {
                        //Tracevv((stderr, "inflate:         end of block\n"));
                        state.back = -1
                        state.mode = TYPE$1
                        break
                    }
                    if (here_op & 64) {
                        strm.msg = 'invalid literal/length code'
                        state.mode = BAD$1
                        break
                    }
                    state.extra = here_op & 15
                    state.mode = LENEXT
                /* falls through */
                case LENEXT:
                    if (state.extra) {
                        //=== NEEDBITS(state.extra);
                        n = state.extra
                        while (bits < n) {
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                        }
                        //===//
                        state.length += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
                        //--- DROPBITS(state.extra) ---//
                        hold >>>= state.extra
                        bits -= state.extra
                        //---//
                        state.back += state.extra
                    }
                    //Tracevv((stderr, "inflate:         length %u\n", state.length));
                    state.was = state.length
                    state.mode = DIST
                /* falls through */
                case DIST:
                    for (;;) {
                        here = state.distcode[hold & ((1 << state.distbits) - 1)] /*BITS(state.distbits)*/
                        here_bits = here >>> 24
                        here_op = (here >>> 16) & 0xff
                        here_val = here & 0xffff

                        if (here_bits <= bits) {
                            break
                        }
                        //--- PULLBYTE() ---//
                        if (have === 0) {
                            break inf_leave
                        }
                        have--
                        hold += input[next++] << bits
                        bits += 8
                        //---//
                    }
                    if ((here_op & 0xf0) === 0) {
                        last_bits = here_bits
                        last_op = here_op
                        last_val = here_val
                        for (;;) {
                            here =
                                state.distcode[
                                    last_val +
                                        ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >>
                                            last_bits)
                                ]
                            here_bits = here >>> 24
                            here_op = (here >>> 16) & 0xff
                            here_val = here & 0xffff

                            if (last_bits + here_bits <= bits) {
                                break
                            }
                            //--- PULLBYTE() ---//
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                            //---//
                        }
                        //--- DROPBITS(last.bits) ---//
                        hold >>>= last_bits
                        bits -= last_bits
                        //---//
                        state.back += last_bits
                    }
                    //--- DROPBITS(here.bits) ---//
                    hold >>>= here_bits
                    bits -= here_bits
                    //---//
                    state.back += here_bits
                    if (here_op & 64) {
                        strm.msg = 'invalid distance code'
                        state.mode = BAD$1
                        break
                    }
                    state.offset = here_val
                    state.extra = here_op & 15
                    state.mode = DISTEXT
                /* falls through */
                case DISTEXT:
                    if (state.extra) {
                        //=== NEEDBITS(state.extra);
                        n = state.extra
                        while (bits < n) {
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                        }
                        //===//
                        state.offset += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
                        //--- DROPBITS(state.extra) ---//
                        hold >>>= state.extra
                        bits -= state.extra
                        //---//
                        state.back += state.extra
                    }
                    //#ifdef INFLATE_STRICT
                    if (state.offset > state.dmax) {
                        strm.msg = 'invalid distance too far back'
                        state.mode = BAD$1
                        break
                    }
                    //#endif
                    //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
                    state.mode = MATCH
                /* falls through */
                case MATCH:
                    if (left === 0) {
                        break inf_leave
                    }
                    copy = _out - left
                    if (state.offset > copy) {
                        /* copy from window */
                        copy = state.offset - copy
                        if (copy > state.whave) {
                            if (state.sane) {
                                strm.msg = 'invalid distance too far back'
                                state.mode = BAD$1
                                break
                            }
                            // (!) This block is disabled in zlib defaults,
                            // don't enable it for binary compatibility
                            //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
                            //          Trace((stderr, "inflate.c too far\n"));
                            //          copy -= state.whave;
                            //          if (copy > state.length) { copy = state.length; }
                            //          if (copy > left) { copy = left; }
                            //          left -= copy;
                            //          state.length -= copy;
                            //          do {
                            //            output[put++] = 0;
                            //          } while (--copy);
                            //          if (state.length === 0) { state.mode = LEN; }
                            //          break;
                            //#endif
                        }
                        if (copy > state.wnext) {
                            copy -= state.wnext
                            from = state.wsize - copy
                        } else {
                            from = state.wnext - copy
                        }
                        if (copy > state.length) {
                            copy = state.length
                        }
                        from_source = state.window
                    } else {
                        /* copy from output */
                        from_source = output
                        from = put - state.offset
                        copy = state.length
                    }
                    if (copy > left) {
                        copy = left
                    }
                    left -= copy
                    state.length -= copy
                    do {
                        output[put++] = from_source[from++]
                    } while (--copy)
                    if (state.length === 0) {
                        state.mode = LEN
                    }
                    break
                case LIT:
                    if (left === 0) {
                        break inf_leave
                    }
                    output[put++] = state.length
                    left--
                    state.mode = LEN
                    break
                case CHECK:
                    if (state.wrap) {
                        //=== NEEDBITS(32);
                        while (bits < 32) {
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            // Use '|' instead of '+' to make sure that result is signed
                            hold |= input[next++] << bits
                            bits += 8
                        }
                        //===//
                        _out -= left
                        strm.total_out += _out
                        state.total += _out
                        if (_out) {
                            strm.adler = state.check =
                                /*UPDATE(state.check, put - _out, _out);*/
                                state.flags
                                    ? crc32_1(state.check, output, _out, put - _out)
                                    : adler32_1(state.check, output, _out, put - _out)
                        }
                        _out = left
                        // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
                        if ((state.flags ? hold : zswap32(hold)) !== state.check) {
                            strm.msg = 'incorrect data check'
                            state.mode = BAD$1
                            break
                        }
                        //=== INITBITS();
                        hold = 0
                        bits = 0
                        //===//
                        //Tracev((stderr, "inflate:   check matches trailer\n"));
                    }
                    state.mode = LENGTH
                /* falls through */
                case LENGTH:
                    if (state.wrap && state.flags) {
                        //=== NEEDBITS(32);
                        while (bits < 32) {
                            if (have === 0) {
                                break inf_leave
                            }
                            have--
                            hold += input[next++] << bits
                            bits += 8
                        }
                        //===//
                        if (hold !== (state.total & 0xffffffff)) {
                            strm.msg = 'incorrect length check'
                            state.mode = BAD$1
                            break
                        }
                        //=== INITBITS();
                        hold = 0
                        bits = 0
                        //===//
                        //Tracev((stderr, "inflate:   length matches trailer\n"));
                    }
                    state.mode = DONE
                /* falls through */
                case DONE:
                    ret = Z_STREAM_END$2
                    break inf_leave
                case BAD$1:
                    ret = Z_DATA_ERROR$1
                    break inf_leave
                case MEM:
                    return Z_MEM_ERROR
                case SYNC:
                /* falls through */
                default:
                    return Z_STREAM_ERROR$1
            }
        }

        // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

        /*
         Return from inflate(), updating the total counts and the check value.
         If there was no progress during the inflate() call, return a buffer
         error.  Call updatewindow() to create and/or update the window state.
         Note: a memory error from inflate() is non-recoverable.
       */

        //--- RESTORE() ---
        strm.next_out = put
        strm.avail_out = left
        strm.next_in = next
        strm.avail_in = have
        state.hold = hold
        state.bits = bits
        //---

        if (
            state.wsize ||
            (_out !== strm.avail_out && state.mode < BAD$1 && (state.mode < CHECK || flush !== Z_FINISH$2))
        ) {
            if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out));
        }
        _in -= strm.avail_in
        _out -= strm.avail_out
        strm.total_in += _in
        strm.total_out += _out
        state.total += _out
        if (state.wrap && _out) {
            strm.adler = state.check =
                /*UPDATE(state.check, strm.next_out - _out, _out);*/
                state.flags
                    ? crc32_1(state.check, output, _out, strm.next_out - _out)
                    : adler32_1(state.check, output, _out, strm.next_out - _out)
        }
        strm.data_type =
            state.bits +
            (state.last ? 64 : 0) +
            (state.mode === TYPE$1 ? 128 : 0) +
            (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0)
        if (((_in === 0 && _out === 0) || flush === Z_FINISH$2) && ret === Z_OK$2) {
            ret = Z_BUF_ERROR$1
        }
        return ret
    }

    function inflateEnd(strm) {
        if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
            return Z_STREAM_ERROR$1
        }

        var state = strm.state
        if (state.window) {
            state.window = null
        }
        strm.state = null
        return Z_OK$2
    }

    function inflateGetHeader(strm, head) {
        var state

        /* check state */
        if (!strm || !strm.state) {
            return Z_STREAM_ERROR$1
        }
        state = strm.state
        if ((state.wrap & 2) === 0) {
            return Z_STREAM_ERROR$1
        }

        /* save header structure */
        state.head = head
        head.done = false
        return Z_OK$2
    }

    function inflateSetDictionary(strm, dictionary) {
        var dictLength = dictionary.length

        var state
        var dictid
        var ret

        /* check state */
        if (!strm /* == Z_NULL */ || !strm.state /* == Z_NULL */) {
            return Z_STREAM_ERROR$1
        }
        state = strm.state

        if (state.wrap !== 0 && state.mode !== DICT) {
            return Z_STREAM_ERROR$1
        }

        /* check for correct dictionary identifier */
        if (state.mode === DICT) {
            dictid = 1 /* adler32(0, null, 0)*/
            /* dictid = adler32(dictid, dictionary, dictLength); */
            dictid = adler32_1(dictid, dictionary, dictLength, 0)
            if (dictid !== state.check) {
                return Z_DATA_ERROR$1
            }
        }
        /* copy dictionary to window using updatewindow(), which will amend the
       existing dictionary if appropriate */
        ret = updatewindow(strm, dictionary, dictLength, dictLength)
        if (ret) {
            state.mode = MEM
            return Z_MEM_ERROR
        }
        state.havedict = 1
        // Tracev((stderr, "inflate:   dictionary set\n"));
        return Z_OK$2
    }

    var inflateReset_1 = inflateReset
    var inflateReset2_1 = inflateReset2
    var inflateResetKeep_1 = inflateResetKeep
    var inflateInit_1 = inflateInit
    var inflateInit2_1 = inflateInit2
    var inflate_2 = inflate
    var inflateEnd_1 = inflateEnd
    var inflateGetHeader_1 = inflateGetHeader
    var inflateSetDictionary_1 = inflateSetDictionary
    var inflateInfo = 'pako inflate (from Nodeca project)'

    /* Not implemented
    exports.inflateCopy = inflateCopy;
    exports.inflateGetDictionary = inflateGetDictionary;
    exports.inflateMark = inflateMark;
    exports.inflatePrime = inflatePrime;
    exports.inflateSync = inflateSync;
    exports.inflateSyncPoint = inflateSyncPoint;
    exports.inflateUndermine = inflateUndermine;
    */

    var inflate_1 = {
        inflateReset: inflateReset_1,
        inflateReset2: inflateReset2_1,
        inflateResetKeep: inflateResetKeep_1,
        inflateInit: inflateInit_1,
        inflateInit2: inflateInit2_1,
        inflate: inflate_2,
        inflateEnd: inflateEnd_1,
        inflateGetHeader: inflateGetHeader_1,
        inflateSetDictionary: inflateSetDictionary_1,
        inflateInfo: inflateInfo
    }

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    var constants = {
        /* Allowed flush values; see deflate() and inflate() below for details */
        Z_NO_FLUSH: 0,
        Z_PARTIAL_FLUSH: 1,
        Z_SYNC_FLUSH: 2,
        Z_FULL_FLUSH: 3,
        Z_FINISH: 4,
        Z_BLOCK: 5,
        Z_TREES: 6,

        /* Return codes for the compression/decompression functions. Negative values
         * are errors, positive values are used for special but normal events.
         */
        Z_OK: 0,
        Z_STREAM_END: 1,
        Z_NEED_DICT: 2,
        Z_ERRNO: -1,
        Z_STREAM_ERROR: -2,
        Z_DATA_ERROR: -3,
        //Z_MEM_ERROR:     -4,
        Z_BUF_ERROR: -5,
        //Z_VERSION_ERROR: -6,

        /* compression levels */
        Z_NO_COMPRESSION: 0,
        Z_BEST_SPEED: 1,
        Z_BEST_COMPRESSION: 9,
        Z_DEFAULT_COMPRESSION: -1,

        Z_FILTERED: 1,
        Z_HUFFMAN_ONLY: 2,
        Z_RLE: 3,
        Z_FIXED: 4,
        Z_DEFAULT_STRATEGY: 0,

        /* Possible values of the data_type field (though see inflate()) */
        Z_BINARY: 0,
        Z_TEXT: 1,
        //Z_ASCII:                1, // = Z_TEXT (deprecated)
        Z_UNKNOWN: 2,

        /* The deflate compression method */
        Z_DEFLATED: 8
        //Z_NULL:                 null // Use -1 or null inline, depending on var type
    }

    // (C) 1995-2013 Jean-loup Gailly and Mark Adler
    // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
    //
    // This software is provided 'as-is', without any express or implied
    // warranty. In no event will the authors be held liable for any damages
    // arising from the use of this software.
    //
    // Permission is granted to anyone to use this software for any purpose,
    // including commercial applications, and to alter it and redistribute it
    // freely, subject to the following restrictions:
    //
    // 1. The origin of this software must not be misrepresented; you must not
    //   claim that you wrote the original software. If you use this software
    //   in a product, an acknowledgment in the product documentation would be
    //   appreciated but is not required.
    // 2. Altered source versions must be plainly marked as such, and must not be
    //   misrepresented as being the original software.
    // 3. This notice may not be removed or altered from any source distribution.

    function GZheader() {
        /* true if compressed data believed to be text */
        this.text = 0
        /* modification time */
        this.time = 0
        /* extra flags (not used when writing a gzip file) */
        this.xflags = 0
        /* operating system */
        this.os = 0
        /* pointer to extra field or Z_NULL if none */
        this.extra = null
        /* extra field length (valid if extra != Z_NULL) */
        this.extra_len = 0 // Actually, we don't need it in JS,
        // but leave for few code modifications

        //
        // Setup limits is not necessary because in js we should not preallocate memory
        // for inflate use constant limit in 65536 bytes
        //

        /* space at extra (only when reading header) */
        // this.extra_max  = 0;
        /* pointer to zero-terminated file name or Z_NULL */
        this.name = ''
        /* space at name (only when reading header) */
        // this.name_max   = 0;
        /* pointer to zero-terminated comment or Z_NULL */
        this.comment = ''
        /* space at comment (only when reading header) */
        // this.comm_max   = 0;
        /* true if there was or will be a header crc */
        this.hcrc = 0
        /* true when done reading gzip header (not used when writing a gzip file) */
        this.done = false
    }

    var gzheader = GZheader

    var toString$1 = Object.prototype.toString

    /**
     * class Inflate
     *
     * Generic JS-style wrapper for zlib calls. If you don't need
     * streaming behaviour - use more simple functions: [[inflate]]
     * and [[inflateRaw]].
     **/

    /* internal
     * inflate.chunks -> Array
     *
     * Chunks of output data, if [[Inflate#onData]] not overridden.
     **/

    /**
     * Inflate.result -> Uint8Array|Array|String
     *
     * Uncompressed result, generated by default [[Inflate#onData]]
     * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
     * (call [[Inflate#push]] with `Z_FINISH` / `true` param) or if you
     * push a chunk with explicit flush (call [[Inflate#push]] with
     * `Z_SYNC_FLUSH` param).
     **/

    /**
     * Inflate.err -> Number
     *
     * Error code after inflate finished. 0 (Z_OK) on success.
     * Should be checked if broken data possible.
     **/

    /**
     * Inflate.msg -> String
     *
     * Error message, if [[Inflate.err]] != 0
     **/

    /**
     * new Inflate(options)
     * - options (Object): zlib inflate options.
     *
     * Creates new inflator instance with specified params. Throws exception
     * on bad params. Supported options:
     *
     * - `windowBits`
     * - `dictionary`
     *
     * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
     * for more information on these.
     *
     * Additional options, for internal needs:
     *
     * - `chunkSize` - size of generated data chunks (16K by default)
     * - `raw` (Boolean) - do raw inflate
     * - `to` (String) - if equal to 'string', then result will be converted
     *   from utf8 to utf16 (javascript) string. When string output requested,
     *   chunk length can differ from `chunkSize`, depending on content.
     *
     * By default, when no options set, autodetect deflate/gzip data format via
     * wrapper header.
     *
     * ##### Example:
     *
     * ```javascript
     * var pako = require('pako')
     *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
     *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
     *
     * var inflate = new pako.Inflate({ level: 3});
     *
     * inflate.push(chunk1, false);
     * inflate.push(chunk2, true);  // true -> last chunk
     *
     * if (inflate.err) { throw new Error(inflate.err); }
     *
     * console.log(inflate.result);
     * ```
     **/
    function Inflate(options) {
        if (!(this instanceof Inflate)) return new Inflate(options)

        this.options = common.assign(
            {
                chunkSize: 16384,
                windowBits: 0,
                to: ''
            },
            options || {}
        )

        var opt = this.options

        // Force window size for `raw` data, if not set directly,
        // because we have no header for autodetect.
        if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
            opt.windowBits = -opt.windowBits
            if (opt.windowBits === 0) {
                opt.windowBits = -15
            }
        }

        // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
        if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
            opt.windowBits += 32
        }

        // Gzip header has no info about windows size, we can do autodetect only
        // for deflate. So, if window size not set, force it to max when gzip possible
        if (opt.windowBits > 15 && opt.windowBits < 48) {
            // bit 3 (16) -> gzipped data
            // bit 4 (32) -> autodetect gzip/deflate
            if ((opt.windowBits & 15) === 0) {
                opt.windowBits |= 15
            }
        }

        this.err = 0 // error code, if happens (0 = Z_OK)
        this.msg = '' // error message
        this.ended = false // used to avoid multiple onEnd() calls
        this.chunks = [] // chunks of compressed data

        this.strm = new zstream()
        this.strm.avail_out = 0

        var status = inflate_1.inflateInit2(this.strm, opt.windowBits)

        if (status !== constants.Z_OK) {
            throw new Error(messages[status])
        }

        this.header = new gzheader()

        inflate_1.inflateGetHeader(this.strm, this.header)

        // Setup dictionary
        if (opt.dictionary) {
            // Convert data if needed
            if (typeof opt.dictionary === 'string') {
                opt.dictionary = strings.string2buf(opt.dictionary)
            } else if (toString$1.call(opt.dictionary) === '[object ArrayBuffer]') {
                opt.dictionary = new Uint8Array(opt.dictionary)
            }
            if (opt.raw) {
                //In raw mode we need to set the dictionary early
                status = inflate_1.inflateSetDictionary(this.strm, opt.dictionary)
                if (status !== constants.Z_OK) {
                    throw new Error(messages[status])
                }
            }
        }
    }

    /**
     * Inflate#push(data[, mode]) -> Boolean
     * - data (Uint8Array|Array|ArrayBuffer|String): input data
     * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
     *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
     *
     * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
     * new output chunks. Returns `true` on success. The last data block must have
     * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
     * [[Inflate#onEnd]]. For interim explicit flushes (without ending the stream) you
     * can use mode Z_SYNC_FLUSH, keeping the decompression context.
     *
     * On fail call [[Inflate#onEnd]] with error code and return false.
     *
     * We strongly recommend to use `Uint8Array` on input for best speed (output
     * format is detected automatically). Also, don't skip last param and always
     * use the same type in your code (boolean or number). That will improve JS speed.
     *
     * For regular `Array`-s make sure all elements are [0..255].
     *
     * ##### Example
     *
     * ```javascript
     * push(chunk, false); // push one of data chunks
     * ...
     * push(chunk, true);  // push last chunk
     * ```
     **/
    Inflate.prototype.push = function (data, mode) {
        var strm = this.strm
        var chunkSize = this.options.chunkSize
        var dictionary = this.options.dictionary
        var status, _mode
        var next_out_utf8, tail, utf8str

        // Flag to properly process Z_BUF_ERROR on testing inflate call
        // when we check that all output data was flushed.
        var allowBufError = false

        if (this.ended) {
            return false
        }
        _mode = mode === ~~mode ? mode : mode === true ? constants.Z_FINISH : constants.Z_NO_FLUSH

        // Convert data if needed
        if (typeof data === 'string') {
            // Only binary strings can be decompressed on practice
            strm.input = strings.binstring2buf(data)
        } else if (toString$1.call(data) === '[object ArrayBuffer]') {
            strm.input = new Uint8Array(data)
        } else {
            strm.input = data
        }

        strm.next_in = 0
        strm.avail_in = strm.input.length

        do {
            if (strm.avail_out === 0) {
                strm.output = new common.Buf8(chunkSize)
                strm.next_out = 0
                strm.avail_out = chunkSize
            }

            status = inflate_1.inflate(strm, constants.Z_NO_FLUSH) /* no bad return value */

            if (status === constants.Z_NEED_DICT && dictionary) {
                status = inflate_1.inflateSetDictionary(this.strm, dictionary)
            }

            if (status === constants.Z_BUF_ERROR && allowBufError === true) {
                status = constants.Z_OK
                allowBufError = false
            }

            if (status !== constants.Z_STREAM_END && status !== constants.Z_OK) {
                this.onEnd(status)
                this.ended = true
                return false
            }

            if (strm.next_out) {
                if (
                    strm.avail_out === 0 ||
                    status === constants.Z_STREAM_END ||
                    (strm.avail_in === 0 && (_mode === constants.Z_FINISH || _mode === constants.Z_SYNC_FLUSH))
                ) {
                    if (this.options.to === 'string') {
                        next_out_utf8 = strings.utf8border(strm.output, strm.next_out)

                        tail = strm.next_out - next_out_utf8
                        utf8str = strings.buf2string(strm.output, next_out_utf8)

                        // move tail
                        strm.next_out = tail
                        strm.avail_out = chunkSize - tail
                        if (tail) {
                            common.arraySet(strm.output, strm.output, next_out_utf8, tail, 0)
                        }

                        this.onData(utf8str)
                    } else {
                        this.onData(common.shrinkBuf(strm.output, strm.next_out))
                    }
                }
            }

            // When no more input data, we should check that internal inflate buffers
            // are flushed. The only way to do it when avail_out = 0 - run one more
            // inflate pass. But if output data not exists, inflate return Z_BUF_ERROR.
            // Here we set flag to process this error properly.
            //
            // NOTE. Deflate does not return error in this case and does not needs such
            // logic.
            if (strm.avail_in === 0 && strm.avail_out === 0) {
                allowBufError = true
            }
        } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== constants.Z_STREAM_END)

        if (status === constants.Z_STREAM_END) {
            _mode = constants.Z_FINISH
        }

        // Finalize on the last chunk.
        if (_mode === constants.Z_FINISH) {
            status = inflate_1.inflateEnd(this.strm)
            this.onEnd(status)
            this.ended = true
            return status === constants.Z_OK
        }

        // callback interim results if Z_SYNC_FLUSH.
        if (_mode === constants.Z_SYNC_FLUSH) {
            this.onEnd(constants.Z_OK)
            strm.avail_out = 0
            return true
        }

        return true
    }

    /**
     * Inflate#onData(chunk) -> Void
     * - chunk (Uint8Array|Array|String): output data. Type of array depends
     *   on js engine support. When string output requested, each chunk
     *   will be string.
     *
     * By default, stores data blocks in `chunks[]` property and glue
     * those in `onEnd`. Override this handler, if you need another behaviour.
     **/
    Inflate.prototype.onData = function (chunk) {
        this.chunks.push(chunk)
    }

    /**
     * Inflate#onEnd(status) -> Void
     * - status (Number): inflate status. 0 (Z_OK) on success,
     *   other if not.
     *
     * Called either after you tell inflate that the input stream is
     * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
     * or if an error happened. By default - join collected chunks,
     * free memory and fill `results` / `err` properties.
     **/
    Inflate.prototype.onEnd = function (status) {
        // On success - join
        if (status === constants.Z_OK) {
            if (this.options.to === 'string') {
                // Glue & convert here, until we teach pako to send
                // utf8 aligned strings to onData
                this.result = this.chunks.join('')
            } else {
                this.result = common.flattenChunks(this.chunks)
            }
        }
        this.chunks = []
        this.err = status
        this.msg = this.strm.msg
    }

    /**
     * inflate(data[, options]) -> Uint8Array|Array|String
     * - data (Uint8Array|Array|String): input data to decompress.
     * - options (Object): zlib inflate options.
     *
     * Decompress `data` with inflate/ungzip and `options`. Autodetect
     * format via wrapper header by default. That's why we don't provide
     * separate `ungzip` method.
     *
     * Supported options are:
     *
     * - windowBits
     *
     * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
     * for more information.
     *
     * Sugar (options):
     *
     * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
     *   negative windowBits implicitly.
     * - `to` (String) - if equal to 'string', then result will be converted
     *   from utf8 to utf16 (javascript) string. When string output requested,
     *   chunk length can differ from `chunkSize`, depending on content.
     *
     *
     * ##### Example:
     *
     * ```javascript
     * var pako = require('pako')
     *   , input = pako.deflate([1,2,3,4,5,6,7,8,9])
     *   , output;
     *
     * try {
     *   output = pako.inflate(input);
     * } catch (err)
     *   console.log(err);
     * }
     * ```
     **/
    function inflate$1(input, options) {
        var inflator = new Inflate(options)

        inflator.push(input, true)

        // That will never happens, if you don't cheat with options :)
        if (inflator.err) {
            throw inflator.msg || messages[inflator.err]
        }

        return inflator.result
    }

    /**
     * inflateRaw(data[, options]) -> Uint8Array|Array|String
     * - data (Uint8Array|Array|String): input data to decompress.
     * - options (Object): zlib inflate options.
     *
     * The same as [[inflate]], but creates raw data, without wrapper
     * (header and adler32 crc).
     **/
    function inflateRaw(input, options) {
        options = options || {}
        options.raw = true
        return inflate$1(input, options)
    }

    /**
     * ungzip(data[, options]) -> Uint8Array|Array|String
     * - data (Uint8Array|Array|String): input data to decompress.
     * - options (Object): zlib inflate options.
     *
     * Just shortcut to [[inflate]], because it autodetects format
     * by header.content. Done for convenience.
     **/

    var Inflate_1 = Inflate
    var inflate_2$1 = inflate$1
    var inflateRaw_1 = inflateRaw
    var ungzip = inflate$1

    var inflate_1$1 = {
        Inflate: Inflate_1,
        inflate: inflate_2$1,
        inflateRaw: inflateRaw_1,
        ungzip: ungzip
    }

    var assign = common.assign

    var pako = {}

    assign(pako, deflate_1$1, inflate_1$1, constants)

    var pako_1 = pako

    function encodePCM(bufferData, opts) {
        const { sampleBits } = opts
        const isLittleEndian = true
        const length = bufferData.length * (opts.sampleBits / 8)
        const data = new DataView(new ArrayBuffer(length))
        let offset = 0
        if (sampleBits === 8) {
            for (let i = 0; i < bufferData.length; i++, offset++) {
                const s = Math.max(-1, Math.min(1, bufferData[i]))
                let val = s < 0 ? s * 128 : s * 127
                val = +val + 128
                data.setInt8(offset, val)
            }
        } else {
            for (let i = 0; i < bufferData.length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, bufferData[i]))
                data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, isLittleEndian)
            }
        }
        return data
    }
    function encodeWAV(data, opts) {
        const PMC = encodePCM(mergeArray(data), opts)
        const arrayBuffer = createWavFile(PMC, opts)
        const blob = new Blob([arrayBuffer], {
            type: 'audio/wav'
        })
        return blob
    }
    function mergeArray(list) {
        const length = list.length * list[0].length
        const data = new Float32Array(length)
        let offset = 0
        for (let i = 0; i < list.length; i++) {
            data.set(list[i], offset)
            offset += list[i].length
        }
        return data
    }
    function createWavFile(audioData, { channelCount, sampleBits, sampleRate }) {
        const WAV_HEAD_SIZE = 44
        const buffer = new ArrayBuffer(WAV_HEAD_SIZE + audioData.byteLength)
        const isLittleEndian = true
        const view = new DataView(buffer)
        writeUTFBytes(view, 0, 'RIFF')
        view.setUint32(4, 36 + audioData.byteLength * 2, isLittleEndian)
        writeUTFBytes(view, 8, 'WAVE')
        writeUTFBytes(view, 12, 'fmt ')
        view.setUint32(16, 16, isLittleEndian)
        view.setUint16(20, 1, isLittleEndian)
        view.setUint16(22, channelCount, isLittleEndian)
        view.setUint32(24, sampleRate, isLittleEndian)
        view.setUint32(28, sampleRate * channelCount * (sampleBits / 8), isLittleEndian)
        view.setUint16(32, channelCount * (sampleBits / 8), isLittleEndian)
        view.setUint16(34, sampleBits, isLittleEndian)
        writeUTFBytes(view, 36, 'data')
        view.setUint32(40, audioData.byteLength, isLittleEndian)
        const length = audioData.byteLength
        let offset = 44
        for (let i = 0; i < length; i++) {
            view.setUint8(offset, audioData.getUint8(i))
            offset++
        }
        return view
    }
    function writeUTFBytes(view, offset, string) {
        const len = string.length
        for (let i = 0; i < len; i++) {
            view.setUint8(offset + i, string.charCodeAt(i))
        }
    }
    function float32ArrayToBase64(data) {
        const uint = new Uint8Array(data.buffer)
        const str = btoa(String.fromCharCode.apply(null, uint))
        return str
    }
    function base64ToFloat32Array(str) {
        const blob = atob(str)
        const bLength = blob.length
        const arrayBuffer = new ArrayBuffer(bLength)
        const dataView = new DataView(arrayBuffer)
        for (let i = 0; i < bLength; i++) {
            dataView.setUint8(i, blob.charCodeAt(i))
        }
        return new Float32Array(arrayBuffer)
    }

    const EXPORT_NAME_LABEL = 'TimeCat'
    const downloadAudioConfig = {
        extractAudioDataList: [],
        opts: {}
    }
    async function exportReplay(exportOptions) {
        recoveryMethods()
        await addNoneFrame()
        const parser = new DOMParser()
        const html = parser.parseFromString(TPL, 'text/html')
        await injectLoading(html)
        await injectData(html, exportOptions)
        await initOptions(html, exportOptions)
        downloadFiles(html)
    }
    function recoveryMethods() {
        const methods = ['HTMLElement.prototype.appendChild']
        methods.forEach(recoverNative.recoverMethod.bind(recoverNative))
    }
    async function addNoneFrame() {
        const DBOperator = await getDBOperator
        const count = await DBOperator.count()
        if (count) {
            DBOperator.add({
                type: RecordType.TERMINATE,
                data: null,
                time: getRadix64TimeStr()
            })
        }
    }
    function downloadHTML(content) {
        const blob = new Blob([content], { type: 'text/html' })
        download(blob, `${EXPORT_NAME_LABEL}-${getRandomCode()}.html`)
    }
    function downloadFiles(html) {
        downloadHTML(html.documentElement.outerHTML)
        downloadAudios()
    }
    function downloadAudios() {
        if (window.__ReplayData__) {
            const replayData = window.__ReplayData__
            if (replayData.audio) {
                const { src } = replayData.audio
                download(src, src)
                return
            }
        }
        downloadAudioConfig.extractAudioDataList.forEach(extractedData => {
            const floatArray = extractedData.source.map(data => base64ToFloat32Array(data))
            const audioBlob = encodeWAV(floatArray, downloadAudioConfig.opts)
            download(audioBlob, extractedData.fileName)
        })
        downloadAudioConfig.extractAudioDataList.length = 0
    }
    async function initOptions(html, exportOptions) {
        const { scripts, autoplay } = exportOptions
        const options = { autoplay }
        const scriptList = scripts || []
        if (!scriptList.some(item => item.name === 'time-cat-init')) {
            scriptList.push({
                name: 'time-cat-init',
                src: `new TimeCat.Player(${JSON.stringify(options)})`
            })
        }
        await injectScripts(html, scriptList)
    }
    async function injectScripts(html, scripts) {
        if (scripts) {
            for (const scriptItem of scripts) {
                const { src, name } = scriptItem
                let scriptContent = src
                const script = document.createElement('script')
                if (name) {
                    script.id = name
                }
                const isUrlReg = /^(chrome-extension|https?):\/\/.+/
                if (isUrlReg.test(src)) {
                    {
                        scriptContent = await getScript(src)
                    }
                }
                script.text = scriptContent
                html.body.appendChild(script)
            }
        }
    }
    async function getDataFromDB(exportOptions) {
        const DBOperator = await getDBOperator
        const data = await DBOperator.readAllRecords()
        if (data) {
            const classified = classifyRecords(data)
            return extract(classified, exportOptions)
        }
        return null
    }
    function extract(replayDataList, exportOptions) {
        return replayDataList.map(replayPack => {
            replayPack.body.forEach(replayData => {
                if (exportOptions && exportOptions.audioExternal) {
                    replayData.audio = extractAudio(replayData.audio)
                }
                return replayData
            })
            return replayPack
        })
    }
    function extractAudio(audio) {
        const source = audio.bufferStrList.slice()
        if (!source.length) {
            return audio
        }
        const fileName = `${EXPORT_NAME_LABEL}-audio-${getRandomCode()}.wav`
        downloadAudioConfig.extractAudioDataList.push({
            source,
            fileName
        })
        downloadAudioConfig.opts = audio.opts
        audio.src = fileName
        audio.bufferStrList.length = 0
        return audio
    }
    async function injectLoading(html) {
        const loadingScriptContent = `const loadingNode = document.createElement('div')
    loadingNode.className = 'pacman-box';
    loadingNode.innerHTML = '<style>${pacmanCss}<\/style><div class="pacman"><div><\/div><div><\/div><div><\/div><div><\/div><div><\/div><\/div>'
    loadingNode.setAttribute('style', 'text-align: center;vertical-align: middle;line-height: 100vh;')
    document.body.insertBefore(loadingNode, document.body.firstChild);window.addEventListener('DOMContentLoaded', () => loadingNode.parentNode.removeChild(loadingNode))`
        injectScripts(html, [{ src: loadingScriptContent }])
    }
    async function injectData(html, exportOptions) {
        const data = window.__ReplayPacks__ || (await getDataFromDB(exportOptions))
        if (!data) {
            return
        }
        const extractedData = await makeCssInline(data)
        const jsonStrData = JSON.stringify(extractedData)
        const zipArray = pako_1.gzip(jsonStrData)
        let outputStr = ''
        for (let i = 0; i < zipArray.length; i++) {
            let num = zipArray[i]
            if (~[13, 34, 39, 44, 60, 62, 92, 96, 10, 0].indexOf(num)) {
                num += 300
            }
            outputStr += String.fromCharCode(num)
        }
        const replayData = `var __ReplayStrPacks__ =  '${outputStr}'`
        injectScripts(html, [{ src: replayData }])
    }
    async function makeCssInline(packs) {
        const dataList = []
        packs.forEach(pack => {
            pack.body.forEach(data => {
                dataList.push(data)
            })
        })
        const extractLinkList = []
        for (let k = 0; k < dataList.length; k++) {
            const data = dataList[k]
            const { snapshot, records } = data
            const tasks = [snapshot.data.vNode]
            let node
            while ((node = tasks.shift())) {
                if (isVNode(node)) {
                    extractLink(node, extractLinkList)
                    tasks.push(...node.children)
                }
            }
            for (let i = 0; i < records.length; i++) {
                const record = records[i]
                if (record.type === RecordType.DOM) {
                    const { addedNodes } = record.data
                    for (let j = 0; j < addedNodes.length; j++) {
                        const node = addedNodes[j].node
                        if (isVNode(node)) {
                            extractLink(node, extractLinkList)
                        }
                    }
                }
            }
        }
        for (const node of extractLinkList) {
            const { attrs } = node
            const href = attrs.href
            try {
                const cssURL = new URL(href, location.origin).href
                const cssValue = await fetch(cssURL).then(res => res.text())
                const textNode = {
                    id: nodeStore.createNodeId(),
                    type: Node.TEXT_NODE,
                    value: cssValue
                }
                delete attrs.href
                Object.keys(attrs).forEach(key => {
                    delete attrs[key]
                })
                node.tag = 'style'
                node.attrs.type = 'text/css'
                node.attrs['css-url'] = cssURL
                node.children.push(textNode)
            } catch (error) {}
        }
        return packs
    }
    function extractLink(node, extractLinkList) {
        const { tag, attrs } = node
        if (tag === 'link' && attrs.href && attrs.href.endsWith('.css')) {
            extractLinkList.push(node)
        }
    }

    class Transmitter {
        constructor(uploadUrl) {
            this.interval = 5000
            this.bufferSize = 10
            this.uploadChunksHandle = this.uploadChunks()
            this.uploadUrl = uploadUrl
            this.init()
        }
        async init() {
            this.db = await getDBOperator
            this.uploadChunksHandle()
            this.db.listen('add', this.uploadChunksHandle.bind(this))
        }
        uploadChunks() {
            let timer = null
            let checkNext = false
            const self = this
            return async () => {
                if (timer) {
                    return
                }
                timer = window.setTimeout(clear, this.interval)
                function clear() {
                    clearTimeout(timer)
                    timer = 0
                    if (checkNext) {
                        self.uploadChunksHandle()
                    }
                }
                await delay(1000)
                const records = await this.db.readRecords({ limit: this.bufferSize })
                if (records) {
                    if (await this.uploadToDB(records)) {
                        const range = { lowerBound: records[0].id, upperBound: records.slice(-1)[0].id }
                        this.db.deleteRecords(range)
                    }
                    checkNext = true
                    return
                }
                checkNext = false
            }
        }
        async uploadToDB(records) {
            return await fetch(this.uploadUrl, {
                headers: {
                    'content-type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify(records)
            }).then(() => true)
        }
    }

    class FMP {
        constructor() {
            this.interval = 1000
            this.len = 0
            this.resolved = false
            this.listener = []
            this.timer = null
            this.observe()
        }
        clearTimer() {
            if (this.timer) {
                clearTimeout(this.timer)
                this.timer = null
            }
        }
        observe() {
            this.timer = window.setTimeout(() => {
                const entries = performance.getEntriesByType('resource').filter(item => this.isMatchType(item))
                const len = entries.length
                if (len <= this.len) {
                    performance.clearResourceTimings()
                    this.clearTimer()
                    this.resolved = true
                    if (this.listener.length) {
                        this.listener.forEach(run => run())
                    }
                    return
                }
                this.len = len
                this.observe()
            }, this.interval)
        }
        isMatchType(entry) {
            switch (entry.initiatorType) {
                case 'link':
                case 'img':
                case 'css':
                case 'iframe':
                    return true
            }
        }
        ready(fn) {
            if (this.resolved) {
                return fn()
            }
            this.listener.push(fn)
        }
    }

    const getVNodeByEl = (el, isSVG) => {
        if (isElementNode(el)) {
            return {
                id: nodeStore.createNodeId(),
                type: el.nodeType,
                attrs: getAttr(el),
                tag: el.tagName.toLocaleLowerCase(),
                children: [],
                extra: getExtra(el, isSVG)
            }
        } else {
            return {
                id: nodeStore.createNodeId(),
                type: el.nodeType,
                value: el.textContent
            }
        }
    }
    const getAttr = el => {
        const resAttr = {}
        const { attributes } = el
        if (attributes && attributes.length) {
            return Object.values(attributes).reduce((ret, attr) => {
                const [name, value] = extraAttr(attr)
                if (name) {
                    ret[name] = value
                }
                return ret
            }, resAttr)
        }
        return resAttr
    }
    function getExtra(node, isSVG) {
        const { tagName } = node
        const extra = {}
        const props = {}
        if (isSVG || tagName.toLowerCase() === 'svg') {
            extra.isSVG = true
        }
        if (tagName === 'INPUT') {
            const { checked, value } = node
            if (value !== undefined) {
                props.value = value
            }
            if (checked !== undefined) {
                props.checked = checked
            }
        }
        const scrollLeft = node.scrollLeft
        const scrollTop = node.scrollTop
        if (scrollTop || scrollLeft) {
            props.scroll = {
                left: scrollLeft,
                top: scrollTop
            }
        }
        if (Object.keys(props).length) {
            extra.props = props
        }
        return extra
    }
    const extraAttr = attr => {
        const { name, value } = attr
        if (name === 'href' || name === 'src') {
            if (value.startsWith('#/')) {
                return []
            }
            return [name, value]
        }
        return [name, value]
    }
    const createFlatVNode = (el, isSVG = false) => {
        const vNode = getVNodeByEl(el, isSVG)
        const { id } = vNode
        nodeStore.addNode(el, id)
        return vNode
    }
    const createElement = (el, inheritSVG) => {
        const vNode = getVNodeByEl(el, inheritSVG)
        const { id } = vNode
        nodeStore.addNode(el, id)
        if (vNode.type === Node.ELEMENT_NODE) {
            const vn = vNode
            inheritSVG = inheritSVG || vn.extra.isSVG
            el.childNodes.forEach(node => {
                const child = createElement(node, inheritSVG)
                if (child) {
                    vn.children.push(child)
                }
            })
        }
        return vNode
    }

    function setAttribute(node, name, value) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return
        }
        if (name === 'style') {
            if (typeof value === 'string') {
                node.style.cssText = completeCssHref(value)
            } else if (value !== null && typeof value === 'object') {
                for (const [k, v] of Object.entries(value)) {
                    if (k[0] === '-') {
                        node.style.setProperty(k, v)
                    } else {
                        node.style[k] = v
                    }
                }
            }
            return
        }
        if (value && typeof value === 'string' && /\.js$/.test(value)) {
            return
        }
        if (!/^[\w\-\d]+$/.test(name)) {
            return
        }
        if (/^on\w+$/.test(name)) {
            return
        }
        if (value === null) {
            return node.removeAttribute(name)
        }
        value = String(value)
        if (name === 'href') {
            value = completeAttrHref(String(value), node)
        }
        if (name === 'background' || name === 'src') {
            if (value.startsWith('data:'));
            else {
                value = proxyResource(completeAttrHref(String(value), node))
            }
        }
        if (name === 'srcset') {
            const srcArray = value.split(',')
            value = srcArray.map(src => proxyResource(completeAttrHref(src.trim(), node))).toString()
        }
        if (value.startsWith('/')) {
            value = completeAttrHref(value, node)
        }
        return node.setAttribute(name, value)
    }

    function convertVNode(vNode, parent) {
        if (vNode === null || vNode === undefined) {
            return null
        }
        const vs = vNode
        if (vNode.type === Node.COMMENT_NODE) {
            return createCommentNode(vs)
        }
        if (vNode.type === Node.TEXT_NODE) {
            if (parent && parent.tag === 'style') {
                vs.value = completeCssHref(vs.value, parent)
            }
            return createText(vs)
        }
        const vn = vNode
        const output = createNode(vn)
        if ((vn.children && vn.children.length) || (output.childNodes && output.childNodes.length)) {
            travel(vn, output)
        }
        return output
    }
    function travel(vNode, node) {
        const nodeChildren = []
        const vNodeChildren = vNode.children.slice()
        vNodeChildren.forEach(vChild => {
            let child = nodeChildren.pop()
            child = convertVNode(vChild, vNode)
            if (child) {
                if (isHideComment(node.lastChild)) {
                    setAttribute(child, 'style', 'visibility: hidden')
                }
                node.appendChild(child)
            }
        })
    }
    function createProps(vNode, node) {
        const { props } = vNode.extra
        if (props) {
            for (const [key, val] of Object.entries(props)) {
                if (key === 'scroll') {
                    const { left, top } = val
                    setTimeout(() => {
                        node.scrollTop = top
                        node.scrollLeft = left
                    }, 1000)
                } else {
                    node[key] = val
                }
            }
        }
    }
    function createAttributes(vNode, node) {
        const attrs = getAttributes(vNode)
        for (const [name, val] of Object.entries(attrs)) {
            setAttribute(node, name, val)
        }
        if (vNode.tag === 'a') {
            node.setAttribute('target', '_blank')
        }
    }
    function getAttributes(vNode) {
        const attrs = { ...vNode.attrs }
        if (vNode.tag === 'iframe') {
            attrs['disabled-src'] = attrs.src
            delete attrs.src
        }
        return attrs
    }
    function createSpecialNode(vsNode) {
        const { type, value, id } = vsNode
        let output
        switch (type) {
            case Node.TEXT_NODE:
                output = document.createTextNode(value)
                break
            case Node.COMMENT_NODE:
                output = document.createComment(value)
                break
        }
        nodeStore.updateNode(id, output)
        return output
    }
    function createNode(vNode) {
        const { id, extra } = vNode
        const { isSVG } = extra
        let output
        const tagName = transformTagName(vNode.tag)
        if (isSVG) {
            output = document.createElementNS('http://www.w3.org/2000/svg', tagName)
        } else {
            output = document.createElement(tagName)
        }
        createAttributes(vNode, output)
        createProps(vNode, output)
        nodeStore.updateNode(id, output)
        return output
    }
    function transformTagName(tag) {
        const tagMap = {
            script: 'noscript',
            altglyph: 'altGlyph',
            altglyphdef: 'altGlyphDef',
            altglyphitem: 'altGlyphItem',
            animatecolor: 'animateColor',
            animatemotion: 'animateMotion',
            animatetransform: 'animateTransform',
            clippath: 'clipPath',
            feblend: 'feBlend',
            fecolormatrix: 'feColorMatrix',
            fecomponenttransfer: 'feComponentTransfer',
            fecomposite: 'feComposite',
            feconvolvematrix: 'feConvolveMatrix',
            fediffuselighting: 'feDiffuseLighting',
            fedisplacementmap: 'feDisplacementMap',
            fedistantlight: 'feDistantLight',
            feflood: 'feFlood',
            fefunca: 'feFuncA',
            fefuncb: 'feFuncB',
            fefuncg: 'feFuncG',
            fefuncr: 'feFuncR',
            fegaussianblur: 'feGaussianBlur',
            feimage: 'feImage',
            femerge: 'feMerge',
            femergenode: 'feMergeNode',
            femorphology: 'feMorphology',
            feoffset: 'feOffset',
            fepointLight: 'fePointLight',
            fespecularlighting: 'feSpecularLighting',
            fespotlight: 'feSpotLight',
            fetile: 'feTile',
            feturbulence: 'feTurbulence',
            foreignobject: 'foreignObject',
            lineargradient: 'linearGradient',
            radialgradient: 'radialGradient',
            textpath: 'textPath'
        }
        const tagName = tagMap[tag] || tag
        return tagName
    }
    function createText(vs) {
        const { value, id } = vs
        const output = document.createTextNode(value)
        nodeStore.updateNode(id, output)
        return output
    }
    function createCommentNode(vs) {
        const { value, id } = vs
        const output = document.createComment(value)
        nodeStore.updateNode(id, output)
        return output
    }

    class Watcher {
        constructor(options) {
            this.getRadix64TimeStr = getRadix64TimeStr
            this.getNode = id => nodeStore.getNode.call(nodeStore, id)
            this.getNodeId = n => nodeStore.getNodeId.call(nodeStore, n)
            const { emit, context } = options
            this.options = options
            this.context = context
            this.emit = emit
        }
        uninstall(fn) {
            this.options.reverseStore.add(fn)
        }
        emitData(data, callback) {
            if (callback) {
                return this.emit(callback(data))
            }
            this.emit(data)
        }
        registerEvent(options) {
            const { context, eventTypes, handleFn, listenerOptions, type, optimizeOptions, waitTime } = options
            let listenerHandle
            if (type === 'throttle') {
                listenerHandle = throttle(handleFn, waitTime, optimizeOptions)
            } else {
                listenerHandle = debounce(handleFn, waitTime, optimizeOptions)
            }
            eventTypes
                .map(type => fn => {
                    context.addEventListener(type, fn, listenerOptions)
                })
                .forEach(handle => handle(listenerHandle))
            this.uninstall(() => {
                eventTypes.forEach(type => {
                    context.removeEventListener(type, listenerHandle, listenerOptions)
                })
            })
        }
    }

    class DOMWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.init()
        }
        init() {
            const Watcher = new MutationObserver(callback => this.mutationCallback(callback))
            Watcher.observe(this.context.document.documentElement, {
                attributeOldValue: true,
                attributes: true,
                characterData: true,
                characterDataOldValue: true,
                childList: true,
                subtree: true
            })
            this.uninstall(() => Watcher.disconnect())
        }
        mutationCallback(records) {
            const addNodesSet = new Set()
            const removeNodesMap = new Map()
            const moveNodesSet = new Set()
            const moveMarkSet = new Set()
            const attrNodesArray = []
            const textNodesSet = new Set()
            const context = this
            function deepAdd(n, target) {
                const id = context.getNodeId(n)
                if (id) {
                    if (target) {
                        moveNodesSet.add(n)
                        removeNodesMap.delete(n)
                        const targetId = context.getNodeId(target)
                        if (targetId) {
                            moveMarkSet.add(targetId + '@' + id)
                        }
                    }
                } else {
                    addNodesSet.add(n)
                }
                n.childNodes.forEach(cn => deepAdd(cn))
            }
            function deepDeleteInSet(set, n) {
                set.delete(n)
                n.childNodes.forEach(cn => {
                    deepDeleteInSet(set, cn)
                })
            }
            function rmNode(n, target) {
                if (!n) {
                    return
                }
                const id = context.getNodeId(n)
                const pId = context.getNodeId(n.parentNode)
                if (addNodesSet.has(n)) {
                    deepDeleteInSet(addNodesSet, n)
                    removeNodesMap.set(n, target)
                } else if (moveNodesSet.has(n) && moveMarkSet.has(pId + '@' + id)) {
                    deepDeleteInSet(moveNodesSet, n)
                    moveMarkSet.delete(pId + '@' + id)
                } else {
                    removeNodesMap.set(n, target)
                }
            }
            records.forEach(record => {
                const { target, addedNodes, removedNodes, type, attributeName, oldValue } = record
                switch (type) {
                    case 'attributes':
                        attrNodesArray.push({ key: attributeName, node: target, oldValue })
                        break
                    case 'characterData':
                        textNodesSet.add(target)
                        break
                    case 'childList':
                        addedNodes.forEach(n => deepAdd(n, target))
                        removedNodes.forEach(n => rmNode(n, target))
                        break
                }
            })
            const addedSiblingMap = new Map()
            addNodesSet.forEach(node => {
                const vn = createFlatVNode(node)
                addedSiblingMap.set(node, vn)
            })
            const addedNodes = []
            const addedVNodesMap = new Map()
            addNodesSet.forEach(node => {
                const parentId = this.getNodeId(node.parentNode)
                const parentVn = addedVNodesMap.get(parentId)
                const isParentSVG = parentVn && parentVn.extra.isSVG
                const vn = addedSiblingMap.get(node)
                if (isParentSVG && isVNode(vn)) {
                    vn.extra.isSVG = true
                }
                addedNodes.push({
                    parentId,
                    nextId: this.getNodeId(node.nextSibling) || null,
                    node: vn
                })
                if (isVNode(vn)) {
                    addedVNodesMap.set(vn.id, vn)
                }
            })
            const movedNodes = []
            moveNodesSet.forEach(node => {
                const nodeId = this.getNodeId(node)
                movedNodes.push({
                    parentId: this.getNodeId(node.parentNode),
                    nextId: this.getNodeId(node.nextSibling) || null,
                    id: nodeId
                })
            })
            const removedNodes = []
            removeNodesMap.forEach((parent, node) => {
                const id = this.getNodeId(node)
                const parentId = this.getNodeId(parent)
                if (parentId) {
                    removedNodes.push({
                        parentId,
                        id
                    })
                }
            })
            const attrs = attrNodesArray
                .map(data => {
                    const { node, key, oldValue } = data
                    if (isExistingNode(node)) {
                        const value = node.getAttribute(key)
                        if (oldValue === value) {
                            return null
                        }
                        const id = this.getNodeId(node)
                        return {
                            id,
                            key,
                            value
                        }
                    }
                })
                .filter(Boolean)
            const texts = [...textNodesSet]
                .map(textNode => {
                    if (isExistingNode(textNode) && textNode.parentNode) {
                        return {
                            id: this.getNodeId(textNode),
                            parentId: this.getNodeId(textNode.parentNode),
                            value: textNode.textContent
                        }
                    }
                })
                .filter(Boolean)
            const data = {
                addedNodes,
                movedNodes,
                removedNodes,
                attrs,
                texts
            }
            if (Object.values(data).some(item => item.length)) {
                this.emitData({
                    type: RecordType.DOM,
                    data,
                    time: this.getRadix64TimeStr()
                })
            }
        }
    }

    class FormElementWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.init()
        }
        init() {
            this.listenInputs(this.options)
            this.kidnapInputs(this.options)
        }
        listenInputs(options) {
            const { context } = options
            const eventTypes = ['input', 'change', 'focus', 'blur']
            const eventListenerOptions = { once: false, passive: true, capture: true }
            eventTypes
                .map(type => fn => {
                    context.document.addEventListener(type, fn, eventListenerOptions)
                    this.uninstall(() => context.document.removeEventListener(type, fn, eventListenerOptions))
                })
                .forEach(call => call(handleFn.bind(this)))
            function handleFn(e) {
                const eventType = e.type
                let data
                switch (eventType) {
                    case 'input':
                    case 'change':
                        const target = e.target
                        const inputType = target.getAttribute('type') || 'text'
                        let key = 'value'
                        const value = target.value || ''
                        let newValue = ''
                        const patches = []
                        if (inputType === 'checkbox' || inputType === 'radio') {
                            if (eventType === 'input') {
                                return
                            }
                            key = 'checked'
                            newValue = target.checked
                        } else {
                            if (value === target.oldValue) {
                                return
                            }
                            if (value.length <= 20 || !target.oldValue) {
                                newValue = value
                            } else {
                                patches.push(...getStrDiffPatches(target.oldValue, value))
                            }
                            target.oldValue = value
                        }
                        data = {
                            type: RecordType.FORM_EL,
                            data: {
                                type: eventType === 'input' ? FormElementEvent.INPUT : FormElementEvent.CHANGE,
                                id: this.getNodeId(e.target),
                                key,
                                value: !patches.length ? newValue : value,
                                patches
                            },
                            time: this.getRadix64TimeStr()
                        }
                        break
                    case 'focus':
                        data = {
                            type: RecordType.FORM_EL,
                            data: {
                                type: FormElementEvent.FOCUS,
                                id: this.getNodeId(e.target)
                            },
                            time: this.getRadix64TimeStr()
                        }
                        break
                    case 'blur':
                        data = {
                            type: RecordType.FORM_EL,
                            data: {
                                type: FormElementEvent.BLUR,
                                id: this.getNodeId(e.target)
                            },
                            time: this.getRadix64TimeStr()
                        }
                        break
                }
                this.emitData(data)
            }
        }
        kidnapInputs(options) {
            const { context } = options
            const self = this
            const elementList = [
                [context.HTMLInputElement.prototype, 'value'],
                [context.HTMLInputElement.prototype, 'checked'],
                [context.HTMLSelectElement.prototype, 'value'],
                [context.HTMLTextAreaElement.prototype, 'value']
            ]
            const handles = elementList.map(item => {
                return () => {
                    const [target, key] = item
                    const original = context.Object.getOwnPropertyDescriptor(target, key)
                    context.Object.defineProperty(target, key, {
                        set: function (value) {
                            setTimeout(() => {
                                handleEvent.call(this, key, value)
                            })
                            if (original && original.set) {
                                original.set.call(this, value)
                            }
                        }
                    })
                    this.uninstall(() => {
                        if (original) {
                            context.Object.defineProperty(target, key, original)
                        }
                    })
                }
            })
            handles.concat([]).forEach(handle => handle())
            function handleEvent(key, value) {
                const data = {
                    type: FormElementEvent.PROP,
                    id: self.getNodeId(this),
                    key,
                    value
                }
                self.emitData({
                    type: RecordType.FORM_EL,
                    data,
                    time: self.getRadix64TimeStr()
                })
            }
        }
    }

    class LocationWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.kidnapLocation = type => {
                const ctx = this.context
                const original = ctx.history[type]
                return function () {
                    const result = original.apply(this, arguments)
                    const e = new Event(type)
                    e.arguments = arguments
                    ctx.dispatchEvent(e)
                    return result
                }
            }
            this.locationHandle = e => {
                var _a, _b
                const contextNodeId = this.getContextNodeId(e)
                const [, , path] = e.arguments || [
                    ,
                    ,
                    (_b = (_a = this.context) === null || _a === void 0 ? void 0 : _a.location) === null ||
                    _b === void 0
                        ? void 0
                        : _b.pathname
                ]
                const { href, hash } = this.context.location
                this.emit({
                    type: RecordType.LOCATION,
                    data: {
                        contextNodeId,
                        href,
                        hash,
                        path
                    },
                    time: this.getRadix64TimeStr()
                })
            }
            this.init()
        }
        init() {
            this.context.history.pushState = this.kidnapLocation('pushState')
            this.context.history.replaceState = this.kidnapLocation('replaceState')
            const types = ['replaceState', 'pushState', 'popstate', 'hashchange']
            types.forEach(type => this.toggleListener('add', type, this.locationHandle))
            this.uninstall(() => {
                types.forEach(type => this.toggleListener('rm', type, this.locationHandle))
            })
        }
        toggleListener(methodType, type, handle) {
            this.context[methodType === 'add' ? 'addEventListener' : 'removeEventListener'](type, handle)
        }
        getContextNodeId(e) {
            return this.getNodeId(e.target.document.documentElement)
        }
    }

    class MouseWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.init()
        }
        init() {
            this.mouseMove()
            this.mouseClick()
        }
        mouseMove() {
            const evt = e => {
                const offsetPosition = this.getOffsetPosition(e, this.context)
                if (offsetPosition) {
                    const { x, y, id } = offsetPosition
                    this.emitData({
                        type: RecordType.MOUSE,
                        data: {
                            type: MouseEventType.MOVE,
                            id,
                            x,
                            y
                        },
                        time: this.getRadix64TimeStr()
                    })
                }
            }
            const name = 'mousemove'
            const listenerHandle = throttle(evt, 350, {
                trailing: true,
                leading: true
            })
            this.context.document.addEventListener(name, listenerHandle)
            this.uninstall(() => {
                this.context.document.removeEventListener(name, listenerHandle)
            })
        }
        mouseClick() {
            const evt = e => {
                const offsetPosition = this.getOffsetPosition(e, this.context)
                if (offsetPosition) {
                    this.emitData({
                        type: RecordType.MOUSE,
                        data: {
                            type: MouseEventType.CLICK,
                            ...offsetPosition
                        },
                        time: this.getRadix64TimeStr()
                    })
                }
            }
            const name = 'click'
            const listenerHandle = throttle(evt, 250)
            this.uninstall(() => {
                this.context.document.removeEventListener(name, listenerHandle)
            })
            this.context.document.addEventListener(name, listenerHandle)
        }
        getOffsetPosition(event, context) {
            var _a
            const { mode } = context.__RecordOptions__
            const { view, target, x, y, offsetX, offsetY } = event
            if (view === context) {
                const doc = target.ownerDocument
                function isInline(target) {
                    return context.getComputedStyle(target).display === 'inline'
                }
                function getRotate(node) {
                    if (!isExistingNode(node)) {
                        return 0
                    }
                    const computedStyle = context.getComputedStyle(node)
                    const matrix = computedStyle['transform']
                    let angle
                    if (matrix !== 'none') {
                        const values = matrix.split('(')[1].split(')')[0].split(',')
                        const a = Number(values[0])
                        const b = Number(values[1])
                        angle = Math.round(Math.atan2(b, a) * (180 / Math.PI))
                    } else {
                        angle = 0
                    }
                    return angle < 0 ? angle + 360 : angle
                }
                let node = target
                let id = undefined
                if (isExistingNode(node)) {
                    while (isInline(node)) {
                        node = node.parentElement
                    }
                    id = this.getNodeId(node)
                }
                const deg = getRotate(node)
                const position = deg
                    ? { x, y }
                    : {
                          id,
                          x: offsetX,
                          y: offsetY
                      }
                const frameElement =
                    (_a = doc === null || doc === void 0 ? void 0 : doc.defaultView) === null || _a === void 0
                        ? void 0
                        : _a.frameElement
                if (frameElement && mode === 'default') {
                    position.y += frameElement.offsetTop
                    position.x += frameElement.offsetLeft
                }
                return position
            }
            return false
        }
    }

    class ScrollWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.getCompatibleTarget = target => target.scrollingElement || target.documentElement
            this.scrollTop = target => target.scrollTop
            this.scrollLeft = target => target.scrollLeft
            this.init()
        }
        init() {
            const { scrollingElement } = this.context.document
            this.emitData(this.wrapData(scrollingElement || document))
            this.registerEvent({
                context: this.context,
                eventTypes: ['scroll'],
                handleFn: this.handleFn.bind(this),
                listenerOptions: { capture: true },
                type: 'throttle',
                optimizeOptions: { leading: true, trailing: true },
                waitTime: 300
            })
        }
        wrapData(target) {
            const element = target instanceof this.context.HTMLElement ? target : this.getCompatibleTarget(target)
            return {
                type: RecordType.SCROLL,
                data: {
                    id: this.getNodeId(element) || null,
                    top: this.scrollTop(element),
                    left: this.scrollLeft(element)
                },
                time: this.getRadix64TimeStr()
            }
        }
        handleFn(e) {
            const { type, target } = e
            if (type === 'scroll') {
                this.emitData(this.wrapData(target))
            }
        }
    }

    class WindowWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.width = () => this.context.innerWidth
            this.height = () => this.context.innerHeight
            this.init()
        }
        init() {
            this.emitData(this.wrapData(this.context.document))
            this.registerEvent({
                context: this.context,
                eventTypes: ['resize'],
                handleFn: this.handleFn.bind(this),
                listenerOptions: { capture: true },
                type: 'throttle',
                optimizeOptions: { trailing: true },
                waitTime: 500
            })
        }
        handleFn(e) {
            const { type, target } = e
            if (type === 'resize') {
                this.emitData(this.wrapData(target))
            }
        }
        wrapData(target) {
            return {
                type: RecordType.WINDOW,
                data: {
                    id: this.getNodeId(target) || null,
                    width: this.width(),
                    height: this.height()
                },
                time: this.getRadix64TimeStr()
            }
        }
    }

    class CanvasWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.aggregateDataEmitter = this.aggregateManager((id, strokes) => {
                this.emitData({
                    type: RecordType.CANVAS,
                    data: {
                        id,
                        strokes
                    },
                    time: this.getRadix64TimeStr()
                })
            }, 100)
            this.init()
        }
        init() {
            const self = this
            const canvasElements = document.getElementsByTagName('canvas')
            Array.from(canvasElements).forEach(canvas => {
                const dataURL = canvas.toDataURL()
                this.emitData({
                    type: RecordType.CANVAS,
                    data: {
                        id: this.getNodeId(canvas),
                        src: dataURL
                    },
                    time: this.getRadix64TimeStr()
                })
            })
            const ctxProto = CanvasRenderingContext2D.prototype
            const names = Object.getOwnPropertyNames(ctxProto)
            names.forEach(name => {
                const original = Object.getOwnPropertyDescriptor(ctxProto, name)
                const method = original.value
                if (name === 'canvas') {
                    return
                }
                Object.defineProperty(ctxProto, name, {
                    get() {
                        const context = this
                        const id = self.getNodeId(this.canvas)
                        return typeof method === 'function'
                            ? function () {
                                  const args = [...arguments]
                                  if (name === 'drawImage') {
                                      args[0] = id
                                  }
                                  self.aggregateDataEmitter(id, name, args)
                                  return method.apply(context, arguments)
                              }
                            : null
                    },
                    set: function (value) {
                        var _a
                        const id = self.getNodeId(this.canvas)
                        self.aggregateDataEmitter(id, name, value)
                        return (_a = original.set) === null || _a === void 0 ? void 0 : _a.apply(this, arguments)
                    }
                })
                this.uninstall(() => {
                    Object.defineProperty(ctxProto, name, original)
                })
            })
        }
        aggregateManager(func, wait) {
            const tasks = Object.create(null)
            const timeouts = Object.create(null)
            const blockInstances = [CanvasGradient]
            return function (id, prop, args) {
                const context = this
                function emitData(id) {
                    const timeout = timeouts[id]
                    clearTimeout(timeout)
                    timeouts[id] = 0
                    const strokes = tasks[id].slice()
                    const clearIndex = strokes.reverse().findIndex(stroke => {
                        if (stroke.name === 'clearRect') {
                            return true
                        }
                    })
                    const aSliceOfShit = !~clearIndex ? strokes.reverse() : strokes.slice(0, clearIndex + 1).reverse()
                    tasks[id].length = 0
                    func.call(context, id, aSliceOfShit)
                }
                if (!tasks[id]) {
                    tasks[id] = []
                }
                if (!blockInstances.some(instance => args instanceof instance)) {
                    tasks[id].push({
                        name: prop,
                        args
                    })
                }
                if (!timeouts[id]) {
                    const timeout = window.setTimeout(() => {
                        emitData(id)
                    }, wait)
                    timeouts[id] = timeout
                }
            }
        }
    }

    class TerminateWatcher extends Watcher {
        constructor(options) {
            super(options)
            this.init()
        }
        init() {
            this.context.addEventListener('beforeunload', this.handleFn)
            this.uninstall(() => {
                this.context.removeEventListener('beforeunload', this.handleFn)
            })
        }
        handleFn() {}
        wrapData() {
            return {
                type: RecordType.TERMINATE,
                data: null,
                time: this.getRadix64TimeStr()
            }
        }
    }

    const watchers = {
        DOMWatcher,
        FormElementWatcher,
        LocationWatcher,
        MouseWatcher,
        ScrollWatcher,
        WindowWatcher,
        CanvasWatcher,
        TerminateWatcher
    }

    class AudioRecorder {
        constructor(opts = AudioRecorder.defaultRecordOptions) {
            this.setOptions(opts)
        }
        getOptions() {
            return this.opts
        }
        setOptions(opts = AudioRecorder.defaultRecordOptions) {
            this.opts = { ...this.opts, ...opts }
        }
        beginRecord() {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.opts.sampleRate
            })
            this.mediaNode = this.audioContext.createMediaStreamSource(this.mediaStream)
            const createScript = this.audioContext.createScriptProcessor
            this.processNode = createScript.call(
                this.audioContext,
                4096,
                this.opts.channelCount,
                this.opts.channelCount
            )
            this.processNode.connect(this.audioContext.destination)
            this.processNode.onaudioprocess = onAudioProcess.bind(this)
            function onAudioProcess(event) {
                const inputBuffer = event.inputBuffer
                const audioBuffer_0 = inputBuffer.getChannelData(0).slice()
                if (this.onProgress) {
                    const data = [float32ArrayToBase64(audioBuffer_0)]
                    this.onProgress(data)
                }
            }
            this.mediaNode.connect(this.processNode)
        }
        async initRecorder() {
            return new Promise((resolve, reject) => {
                window.navigator.mediaDevices
                    .getUserMedia({
                        audio: {
                            sampleRate: this.opts.sampleRate,
                            channelCount: this.opts.channelCount,
                            echoCancellation: true,
                            autoGainControl: true,
                            noiseSuppression: true,
                            latency: 0
                        }
                    })
                    .then(mediaStream => resolve(mediaStream))
                    .catch(err => reject(err))
            })
        }
        async start(opts = AudioRecorder.defaultRecordOptions) {
            this.setOptions(opts)
            this.mediaStream = await this.initRecorder()
            this.mediaStream && this.beginRecord()
        }
        stop() {
            this.mediaStream && this.mediaStream.getAudioTracks()[0].stop()
            this.processNode && this.processNode.disconnect()
            this.mediaNode && this.mediaNode.disconnect()
        }
        pause() {}
        resume() {}
    }
    AudioRecorder.defaultRecordOptions = {
        sampleBits: 8,
        sampleRate: 8000,
        channelCount: 1
    }

    class RecordAudio extends Watcher {
        constructor(options) {
            super(options)
            this.init()
        }
        init() {
            const recorder = new AudioRecorder({
                sampleBits: 8,
                sampleRate: 8000,
                channelCount: 1
            })
            recorder.start()
            this.uninstall(() => {
                recorder.stop()
            })
            this.emitData({
                type: RecordType.AUDIO,
                data: {
                    type: 'opts',
                    data: recorder.getOptions()
                },
                time: this.getRadix64TimeStr()
            })
            recorder.onProgress = audioBase64Data => {
                this.emitData({
                    type: RecordType.AUDIO,
                    data: {
                        type: 'base64',
                        data: audioBase64Data
                    },
                    time: this.getRadix64TimeStr()
                })
            }
        }
    }

    class Snapshot extends Watcher {
        constructor(options) {
            super(options)
            this.init()
        }
        init() {
            const snapshot = this.DOMSnapshot(this.options.context || window)
            this.emitData(snapshot)
        }
        DOMSnapshot(context) {
            return {
                type: RecordType.SNAPSHOT,
                data: {
                    vNode: createElement(context.document.documentElement),
                    ...this.getInitInfo(context)
                },
                time: this.getRadix64TimeStr()
            }
        }
        getInitInfo(context) {
            const { name, publicId, systemId } = context.document.doctype || {}
            const doctype = () => ({ name, publicId, systemId })
            const href = () => context.location.href
            const width = () => context.innerWidth
            const height = () => context.innerHeight
            const scrollTop = () => context.pageYOffset
            const scrollLeft = () => context.pageXOffset
            const getFrameElement = () => context.frameElement
            const frameElement = getFrameElement()
            const frameId = nodeStore.getNodeId(frameElement) || null
            return {
                doctype: doctype(),
                href: href(),
                scrollTop: scrollTop(),
                scrollLeft: scrollLeft(),
                width: width(),
                height: height(),
                frameId
            }
        }
    }

    var name = 'timecat'
    var author = 'oct16'
    var version = '1.2.0-alpha.2'
    var description = 'TimeCat Web Recorder'
    var main = 'lib/timecat.cjs.js'
    var module = 'lib/timecat.esm.js'
    var types = 'lib/timecat.d.ts'
    var files = ['lib']
    var keywords = [
        'recorder',
        'replay',
        'player',
        'virtual-dom',
        'screenshots',
        'audio',
        'video',
        'chrome',
        'chrome-extension'
    ]
    var license = 'GPL-3.0-or-later'
    var workspaces = ['packages/*']
    var scripts = {
        dev: 'node scripts/dev.js',
        build: 'node scripts/build.js',
        release: 'node scripts/release.js',
        live: 'node scripts/live.js',
        test: 'jest',
        embed: 'cp packages/timecat/dist/timecat.global.prod.js ../TimeCatChrome/src/assets/',
        gh: 'node scripts/gh.js',
        count:
            "git ls-files --exclude-standard -- ':!:**/*.[pjs][npv]g' ':!:.eslintrc' ':!: examples/*' ':!:.gitignore' ':!:README.*' ':!:LICENSE' ':!:yarn.lock' | xargs wc -l",
        'ls-lint': 'ls-lint',
        lint: "eslint 'packages/**/*.{js,ts}' --quiet --fix",
        preinstall: 'node ./scripts/checkYarn.js'
    }
    var husky = {
        hooks: {
            'pre-commit': 'ls-lint && lint-staged',
            'commit-msg': 'node ./scripts/verifyCommit.js'
        }
    }
    var engines = {
        node: '>=10.0.0'
    }
    var devDependencies = {
        '@ls-lint/ls-lint': '^1.9.2',
        '@microsoft/api-extractor': '^7.8.9',
        '@rollup/plugin-commonjs': '^11.0.2',
        '@rollup/plugin-html': '^0.1.1',
        '@rollup/plugin-json': '^4.1.0',
        '@rollup/plugin-node-resolve': '^7.1.3',
        '@rollup/plugin-replace': '^2.3.1',
        '@types/diff': '^4.0.2',
        '@types/jest': '^26.0.0',
        '@types/node': '^13.9.2',
        '@types/pako': '^1.0.1',
        '@types/smoothscroll-polyfill': '^0.3.1',
        '@typescript-eslint/eslint-plugin': '^3.9.0',
        '@typescript-eslint/parser': '^3.9.0',
        '@zerollup/ts-transform-paths': '^1.7.17',
        brotli: '^1.3.2',
        'browser-sync': '^2.26.12',
        chalk: '^4.1.0',
        diff: '^4.0.2',
        enquirer: '^2.3.6',
        eslint: '^7.6.0',
        'eslint-config-prettier': '^6.11.0',
        'eslint-plugin-node': '^11.1.0',
        'eslint-plugin-prettier': '^3.1.4',
        execa: '^4.0.0',
        'fs-extra': '^8.1.0',
        husky: '^4.2.5',
        jest: '^26.0.1',
        koa: '^2.13.0',
        'lint-staged': '^10.2.11',
        minimist: '^1.2.5',
        pako: '^1.0.11',
        prettier: '^2.0.5',
        rollup: '^1.32.0',
        'rollup-plugin-scss': '^2.5.0',
        'rollup-plugin-string': '^3.0.0',
        'rollup-plugin-terser': '^5.3.0',
        'rollup-plugin-typescript2': '^0.26.0',
        'rollup-plugin-visualizer': '^4.0.4',
        semver: '^7.3.2',
        'smoothscroll-polyfill': '^0.4.4',
        'ts-jest': '^26.1.0',
        typescript: '^3.9.7'
    }
    var repository = {
        type: 'git',
        url: 'git+https://github.com/oct16/TimeCat.git'
    }
    var bugs = {
        url: 'https://github.com/oct16/TimeCat/issues'
    }
    var homepage = 'https://github.com/oct16/TimeCat#readme'
    var pkg = {
        private: true,
        name: name,
        author: author,
        version: version,
        description: description,
        main: main,
        module: module,
        types: types,
        files: files,
        keywords: keywords,
        license: license,
        workspaces: workspaces,
        scripts: scripts,
        husky: husky,
        'lint-staged': {
            '*.js': ['prettier --write'],
            '*.ts?(x)': ['eslint', 'prettier --parser=typescript --write']
        },
        engines: engines,
        devDependencies: devDependencies,
        repository: repository,
        bugs: bugs,
        homepage: homepage
    }

    function getHeadData() {
        return {
            type: RecordType.HEAD,
            data: {
                href: location.href,
                sessionId: getRandomCode(),
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                beginTime: getTime().toString(),
                version: pkg.version
            },
            time: getRadix64TimeStr()
        }
    }

    class Recorder {
        constructor(options) {
            this.reverseStore = new Set()
            const opts = { ...Recorder.defaultRecordOpts, ...options }
            if (opts && opts.uploadUrl) {
                new Transmitter(opts.uploadUrl)
            }
            this.record(opts)
            this.listenVisibleChange(opts)
        }
        unsubscribe() {
            this.reverseStore.forEach(un => un())
        }
        getRecorders(options) {
            const context = options.context || window
            context.__RecordOptions__ = options
            const recorders = [Snapshot, ...Object.values(watchers)]
            if (options && options.audio) {
                recorders.push(RecordAudio)
            }
            return recorders
        }
        record(options) {
            this.startRecord(options)
        }
        async startRecord(options) {
            const db = await getDBOperator
            const allRecorders = this.getRecorders(options)
            let iframeWatchers = allRecorders
            if (!options || !options.context) {
                if (!options.skip) {
                    db.clear()
                }
            } else {
                iframeWatchers = [
                    Snapshot,
                    watchers.MouseWatcher,
                    watchers.DOMWatcher,
                    watchers.FormElementWatcher,
                    watchers.ScrollWatcher
                ]
            }
            function onEmit(options) {
                const { onData } = options
                return data => {
                    if (!data) {
                        return
                    }
                    let ret
                    if (onData) {
                        ret = onData(data, db)
                        if (!ret) {
                            return
                        }
                    }
                    db.addRecord(ret || data)
                }
            }
            const emit = onEmit(options)
            emit(getHeadData())
            iframeWatchers.forEach(watcher => {
                new watcher({
                    context: (options && options.context) || window,
                    reverseStore: this.reverseStore,
                    emit
                })
            })
            await this.recordFrames()
        }
        async waitingFramesLoaded() {
            const frames = window.frames
            const tasks = Array.from(frames)
                .filter(frame => {
                    try {
                        const frameElement = frame.frameElement
                        return frameElement.getAttribute('src')
                    } catch (e) {
                        logError(e)
                        return false
                    }
                })
                .map(frame => {
                    const frameDocument = frame
                    return new Promise(resolve => {
                        frameDocument.addEventListener('load', () => {
                            resolve(frame)
                        })
                    })
                })
            if (!tasks.length) {
                return Promise.resolve([])
            }
            return Promise.all(tasks)
        }
        async recordFrames() {
            const frames = await this.waitingFramesLoaded()
            frames.forEach(frameWindow => this.record({ context: frameWindow }))
        }
        listenVisibleChange(options) {
            if (typeof document.hidden !== 'undefined') {
                const hidden = 'hidden'
                const visibilityChange = 'visibilitychange'
                function handleVisibilityChange() {
                    if (document[hidden]) {
                        this.unsubscribe()
                    } else {
                        this.record({ ...options, skip: true })
                    }
                }
                document.addEventListener(visibilityChange, handleVisibilityChange.bind(this), false)
                this.reverseStore.add(() =>
                    document.removeEventListener(visibilityChange, handleVisibilityChange.bind(this), false)
                )
            }
        }
    }
    Recorder.defaultRecordOpts = { mode: 'default' }

    var HTML =
        '<div id="cat-container">\n    <div id="cat-player">\n        <iframe id="cat-sandbox" sandbox="allow-same-origin allow-scripts allow-popups"></iframe>\n    </div>\n    <div id="cat-panel">\n\n        <div class="cat-broadcaster">\n            <div class="float-layer" hidden>\n                <span class="subtitle"></span>\n            </div>\n        </div>\n\n        <div class="cat-keyboard">\n            <button class="play-or-pause" type="button" speed="1">▲</button>\n            <button type="button" class="speed" disabled speed="1">1x</button>\n            <button type="button" class="speed" speed="10">10x</button>\n            <button type="button" class="speed" speed="100">100x</button>\n        </div>\n        <div class="cat-timer">\n            <time>\n                00:00\n            </time>\n        </div>\n        <div class="cat-progress">\n            <div class="cat-slider-bar">\n                <div class="cat-current-progress">\n                    <div class="cat-thumb"></div>\n                </div>\n            </div>\n        </div>\n        <div class="cat-export">\n            <button type="button">\n                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px"\n                    y="0px" width="16px" height="15px" viewBox="0 0 511.994 511.994"\n                    style="enable-background:new 0 0 511.994 511.994;" xml:space="preserve">\n                    <path style="fill:#fff;" d="M403.079,310.458c-3.627-7.232-11.008-11.797-19.093-11.797h-64v-85.333c0-11.776-9.536-21.333-21.333-21.333H213.32\n\t\t\tc-11.776,0-21.333,9.557-21.333,21.333v85.333h-64c-8.064,0-15.445,4.565-19.072,11.797c-3.605,7.232-2.837,15.872,2.027,22.336\n\t\t\tl128,170.667c4.011,5.376,10.347,8.533,17.045,8.533c6.72,0,13.056-3.157,17.067-8.533l128-170.667\n            C405.917,326.33,406.685,317.69,403.079,310.458z" />\n                    <path style="fill:#fff;" d="M298.663,128.001H213.33c-11.797,0-21.333,9.536-21.333,21.333c0,11.797,9.536,21.333,21.333,21.333h85.333\n                        c11.797,0,21.333-9.536,21.333-21.333C319.996,137.537,310.46,128.001,298.663,128.001z" />\n                    <path style="fill:#fff;" d="M298.663,64.001H213.33c-11.797,0-21.333,9.536-21.333,21.333s9.536,21.333,21.333,21.333h85.333\n                        c11.797,0,21.333-9.536,21.333-21.333S310.46,64.001,298.663,64.001z" />\n                </svg>\n\n            </button>\n        </div>\n    </div>\n    <div id="cat-start-page" style="display: none;">\n        <div class="play-btn">\n            <svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n                x="0px" y="0px" viewBox="0 0 142.448 142.448" style="enable-background:new 0 0 142.448 142.448;"\n                xml:space="preserve">\n                <g>\n                    <path style="fill:#bbb;" d="M142.411,68.9C141.216,31.48,110.968,1.233,73.549,0.038c-20.361-0.646-39.41,7.104-53.488,21.639\n\t\tC6.527,35.65-0.584,54.071,0.038,73.549c1.194,37.419,31.442,67.667,68.861,68.861c0.779,0.025,1.551,0.037,2.325,0.037\n\t\tc19.454,0,37.624-7.698,51.163-21.676C135.921,106.799,143.033,88.377,142.411,68.9z M111.613,110.336\n\t\tc-10.688,11.035-25.032,17.112-40.389,17.112c-0.614,0-1.228-0.01-1.847-0.029c-29.532-0.943-53.404-24.815-54.348-54.348\n\t\tc-0.491-15.382,5.122-29.928,15.806-40.958c10.688-11.035,25.032-17.112,40.389-17.112c0.614,0,1.228,0.01,1.847,0.029\n\t\tc29.532,0.943,53.404,24.815,54.348,54.348C127.91,84.76,122.296,99.306,111.613,110.336z" />\n                    <path style="fill:#bbb;" d="M94.585,67.086L63.001,44.44c-3.369-2.416-8.059-0.008-8.059,4.138v45.293\n\t\tc0,4.146,4.69,6.554,8.059,4.138l31.583-22.647C97.418,73.331,97.418,69.118,94.585,67.086z" />\n                </g>\n            </svg>\n        </div>\n    </div>\n    <div id="cat-pointer">\n        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAACACAQAAAAhBLbAAAAMkklEQVR42u2ceXAb5RXAfyvJh2xLcqw4dmQ7thPbOSGEOLJbjtIUBgi0wxSmMNNSoDTQMrRAIIUm8E+HuwfD0OkwPZgGUmiBNswUmvhIoBkIsS0DCTShSYAcxHYS27ItW7e0/UOr9a7sla3Tnqnfjjz77fft6uent+977+0BczInczInczInWRYBQf47a0RIqE+cadypoAXpI6KTgMXZgq2LiyyWFK4wEyIHPTp0s81MJkLrMEBx7WdtVzUAJozkYkA3m7EF9OSAYB4LiM6aYqCEQvJmN7YOPXkIwvxTvaJ4+COzBVhAEfnkzF5sAQNGcgTbqV5RFMXDn5hLgXJMsxdbQEcOheQL1af6RFEURfHTQ2YbAgsV2DMGrovTF0GX0JYu73rbXMkZishBj34mda0NLUgeRIZraHDsNlfJ2DOoa13cXkHdX1/vaLcs4ixF5Eh+ZEawp4KOwaqv69o989i6RHeoX9zVVlzDuZnEngp6EqD6JZ0tJTWytvXZx57KPCaV+iUdLdZaCVuffeyEzSMidYs7W621KgeYRfAEoN+lQ9FaXOtosy6O8dtZwk4A+gDNnFK0a2q62+cvmYnpJgFoG7CWHsWW6mpH+/y67E83Cdr0ORr5Uom9qLu9tI4zmLLpABM+EXu5BKeivajK0V7aQF82HWAS3uM4zTHYXa1lS2M8yWyDhiM0MaBoV1d1tpRHsHOzgZ2knz4ag72oqqvVtow+CrPht5OEhs+wq7ArK7tabcsl286w304aGj6nUYVtq3C02ZbThynT2ClAw3HW0q9oL7Q5dttW0Kuw7YxIStBwgkY1dnn3bttKFXYGwFOEhhOs45yiXV7W3VZxHr0UZg47ZWg4jp0zSuxyR2tlFDsj000aoOE4TfSpsLtaFp1Pb6amm7RAwwma6FVhd7ZUr6ZHZSRpA08TNJzErsIuK+9qrblAZdtpc4Bpg4YvaVRhly5wRLCL0o2dRmjoYa0K21rqaK9ZQw9F8imZFuy0QkNvTJpgtXa3166RTklDuqabNENDL40q7JKSfW/aooFrmhxg2qEj2MrsptzmaLXVpxM7A9DQi52TivbCqq7WijRiZwQaemnihKJtq+psrWpIV50kQ9DQh53jauyWRersJmlPkjFoOMs6FXZ5VVdL9bJ0YGcQGvpjsBdUOlqql9GXqt/OKDT006jCnl/haK1eoSo4JCEZhoaBWGybo616ZWp1koxDR7A/V2KXd7fVpISdBWgYwM5nira1zNFauyp57KxAwwBNHFVil3e1LF6likkSAM8SdAT7iAq7s6Xu/JhQaprYWYMGJ3b+G4Ndf0Ey5Z0sQsMwdpW255V17WpYLaUJCWg7q9AwwjoVtmVBZ0vDGnql+vY0/XaWoSPYSiOxlHa1NkSym2l7kqxDwwh2PlW0zdautoYLYzzJbIOOYB9SYpd0tSy9UJFLTnE/yYxAg4tmlZGYrZ0tyxvpoVBx7UYTfIagwcVlqgt8ZmvHrhWNKtvW9CQzBh1JE5TZjcna0bLKTg+mqRzgDEJPzG6KSjp2ntfEabl0qZsce0ahJ2Y3BSX7d53XLJ+SGrY9w9DQTy1tSuzijl3nNXMaE3laoZQhk0DzuZ1RgnHH5HCQ3Vyh2GK0dLTYr/pkPzZAIEgImMZdrgI6cjFhEVadOidK8g+RhJducToSFsMxW9zD538VgSrmUUBu7ISTYfO4Z1qjJpqt0dyxc/VXOCUVinXqUzLD0O/y1yT3zDd37FzTzJcUTLx1MU3QC5iv0fN40sfMM3/wzqVX0DPxtty0QFs5zcMafR/zvKIVCA6PESYkLWHVElIsQYIEyHvnxSY7ThlZAk+D97DSgYFbeJyzGrr+AbnSeo7h7pe2d9ZaQ34hRGjSu99FREJCEJ/gDYzUlrgMFEojhOjIlKEr2UcVUMxmNk864hS/YovcunXd9te/OEsQPwFChCdxZWFEQvjx4fnShQEjY+oBKZpHDR9SJa1volZj1NOKq7rfWHXLFZxDT5gQAfyTLAHJN+vJw4SAT/rX5H8vJeilOBQnoI6tGuOGeUrRevg6vZEBxhhhGCdOBlXLAIMM4mSYEUZx4yNISAIWU4a+kANYVVtuZ43G2GcVxZq6mnuv5CQB3LhwMRyzjEh/RxhlDA8+goTVZpQ09FreJ2/CVi1dB1S63nKzpRInIfx48eDGzZhicePGjQcPXvwECMinbGrQ63HIHkEp1/N1jT3+wEfyeknpz79DPzpEQgQJ4JvUtqPA4VibnlymiD3WxwYPofHgoU0zDrlBGVuMVl5COZUUY5SfolEvkZvOhcmivCQ0fQO7VW2X52vPvSMX6i7nOo39Xudted1YuOU23KonZ0RE1VQT3SaqTSMpTd8Yo2SPr+kxLrrl9+NbHJq6Vv1CwVVXMp9KisnHkFjdNAFNh4GbYwKgMW/jIx3vUb+ttVtOrtdym8YR9rBjvKHfupEQuXL2nYAkAH2CDbwYg2zf+p9uivFw5rG/jW/fqnkMZfh00/UXrcdJPoZEnwtLAPqWGC33j6y+/1A3ZgYZJG/Hzrf3R3uWcJ/GMRz8WdHaupEcDIk/E5YAtBWTonV2aO2mzw5ixomTIdw4H31pvHezaqxa12F5/eorr9lAP/lZqk/3Ou2bTx7FgpMhaRYr2tP299Zo/0Ie0NjzKM8qWg/fiQVBkZ1kDvrT3lU/PXEEE06GGMGFCxceAk+8MD7mfio19n4Sl7ze3Pz96+jHKD8PlqlS7+Ee+/2DpyjCKcUHkSl3DFP3vj+9Fh1VyM809j/LLxWth35MGSFypCkmM5o+cNL+gKuHIobkkMaPDx9ePBge3xb0R0f+hGUax/i14o6Q5SvuuokBjHK1NOUrARNmon1H19w32kchgxKyV4p/A/jxUvj5h79RnI5ars/NE4rWljsKa/FLdp0WTauw3zty8YPiEEacjOBiDC8BOasL4MdDwVMvj8h3hH+PJo3D/pbD8npF9aabccoxSHqvBLR+fPED4hB5kpbdeKUcIxI1RAJN4+DhJ7eN7/OI5tGU08yDd5Stwj39m2qn1rSk6ze7r7yX0QnIYTmyCBHEzxjFz7x6Ur6t5hqu0jjwduS5iMKSh27FRf50dT2VTUvIb+3/5j2EMDAg23IUOWJCYcJSZKz3nnhCoWvtKf0XivW7f7jYjkua0qd0fdrQ0o8u6OC1f117B2H0OHFJeZtfoWWkT8Su3cx7fscB+UrQxdyo8QU72SuvG/Ie2YhPCp+SvKEi+oytUVcnhvbuYSGruZg1NFCJlaJJHsUWENCTjwUbK6m86YHxGPTgpGHqInGb6FcFues2YKECM3lTXeHSa0ALkWm1oko/dPtDfiMFuKRpJJIdT6xXRGtAOgTMnxxZ31gtTYllnMGhGlrMs2xndcyXl1te2YFRSmOTEh0G8jHryvT5LGQZS1hEGfOkCwuT6UFAwEAeFhayjMrL7xzX4UkxR9Zwrvj4hMJuVL61ESOlFJEbP+rTa/YICAhiWMxHj09a/HINQpx0j+hHh+Xzo6uXLV8S6bDg4V0ANrGL9Ro8b+35S+vAgFRGn2aKFQsQ0XUhZoopxkyR5P7jWZuAnjzMlLGU6nXfHddhj2gWrxXPiVryxvv1G6mmgWUswCSV0eN8TRw9S5YdeWGGSAiRMPFSeQHQk0M+JiwMv/DMbd+OdIi4KNJwVTsP3P/y4b2EyWeYYUbxECAYT9dC3O1RnymCyr3FO1rkLQoFmAk3rDz8mi43znj+fWjTqx/sJUyBVG8aw42PgORONUQf54hK2OghprK0cR+iwzTwxbzS5gu0hnYdu+F3jz7f+wUmRCmWic4AU5QN4rtxde/0Tg1B1rUJYX7Nsdct5omDjpy+65Xd7fgw4WcMD268ePEpCsBxvi2eppOTqK4FdJjcJwxF62NCvb7Bjdt+9OwXBylEh0vKfNyylievWSeg6WSxIx7biAlDvvXYqxUV0a5R95Ydz73BGcyEGcONF49UyQvKwFPW7dKvabW/Lgie9uVuuBQgFHjynxuefr8dHfmMMoJLSta8Ch0zNXKmHr6LRCK5GCkil5xjbyyp++POza8MHcOMgTE8qkJuQK7eTfP9Q5mD1mEglwLM+K6+LGBpb8OKCQ9eCdhHQEoiEgLOJHT0VT15GLEwgoEKkDLJqDkEkgHOHHTkyDoJO488cqUSekACDsrF8iReSZXJuxBEwgSBMEG8CCBd1EwJOBvQkRk1KIUdkeuyKQFDZl+5EH3/23iqKsakaCkcOJMiKD7KEy6lF6tl/s0Fsd8wK94DNydzMif/n/I/5OjlEWH8JT8AAAAASUVORK5CYII="\n            alt="pointer">\n        <div class="spinner"></div>\n    </div>\n</div>\n<!--env-->\n<!-- Global site tag (gtag.js) - Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=UA-151180797-1"></script>\n<script>\n    window.dataLayer = window.dataLayer || [];\n    function gtag() { dataLayer.push(arguments); }\n    gtag(\'js\', new Date());\n    gtag(\'config\', \'UA-151180797-1\');\n</script>\n<!--env-->\n'

    var CSS =
        'body {\n  margin: 0;\n  background-color: #e2e2e2;\n  overflow: hidden; }\n\n#cat-main {\n  box-shadow: 0 2px 3px rgba(26, 26, 26, 0.1);\n  transition: all .5s;\n  -webkit-transition: all .5s;\n  opacity: 0;\n  position: relative;\n  overflow: visible; }\n\n#cat-sandbox {\n  background: white;\n  vertical-align: top;\n  border: 0;\n  width: 100%;\n  height: 100%; }\n\n#cat-player {\n  position: relative;\n  width: inherit;\n  height: inherit; }\n\n#cat-pointer {\n  width: 10px;\n  height: 10px;\n  position: absolute;\n  transition: all .2s; }\n  #cat-pointer img {\n    width: 15px;\n    position: absolute;\n    z-index: 100;\n    top: -5px;\n    left: -3px; }\n  #cat-pointer[active] .spinner {\n    width: 32px;\n    height: 32px;\n    left: -17px;\n    top: -18px;\n    position: absolute;\n    background-color: #333;\n    border-radius: 100%;\n    -webkit-animation: spinner-scale .4s 1 ease-in-out;\n    animation: spinner-scale .4s 1 ease-in-out; }\n\n@-webkit-keyframes spinner-scale {\n  0% {\n    -webkit-transform: scale(0); }\n  100% {\n    -webkit-transform: scale(1);\n    opacity: 0.2; } }\n\n@keyframes spinner-scale {\n  0% {\n    -webkit-transform: scale(0);\n    transform: scale(0); }\n  100% {\n    -webkit-transform: scale(1);\n    transform: scale(1);\n    opacity: 0.2; } }\n\n#cat-container {\n  background: grey; }\n\n#cat-panel {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 10px;\n  height: 40px;\n  position: absolute;\n  left: 0;\n  bottom: -41px;\n  background: #535253;\n  opacity: 0.9;\n  display: flex; }\n\n.cat-broadcaster {\n  position: absolute;\n  width: 100%;\n  left: 0;\n  bottom: 50px;\n  display: flex;\n  justify-content: center; }\n  .cat-broadcaster .float-layer {\n    margin: 0 10px;\n    line-height: 20px;\n    color: #fff;\n    background-color: rgba(0, 0, 0, 0.6);\n    border-radius: 2px;\n    padding: 5px;\n    box-shadow: 0px 0px 2px rgba(26, 26, 26, 0.5);\n    text-align: center; }\n    .cat-broadcaster .float-layer[hidden] {\n      display: none; }\n\n.cat-keyboard {\n  height: 20px;\n  white-space: nowrap; }\n  .cat-keyboard button[disabled] {\n    cursor: default;\n    color: #999; }\n\n.cat-export button,\n.cat-keyboard button {\n  border: none;\n  background: none;\n  color: white;\n  outline: none;\n  cursor: pointer;\n  font-size: 13px;\n  padding: 0 5px; }\n  .cat-export button.play-or-pause,\n  .cat-keyboard button.play-or-pause {\n    padding: 0;\n    text-indent: 1px;\n    transform: rotate(90deg);\n    width: 18px; }\n\n.cat-export,\n.cat-progress,\n.cat-keyboard,\n.cat-timer {\n  display: flex;\n  align-items: center; }\n\n.cat-timer {\n  margin-left: 2px; }\n  .cat-timer time {\n    margin-top: 1px;\n    padding: 0 4px;\n    color: white;\n    font-size: 12px;\n    font-family: Helvetica;\n    vertical-align: middle; }\n\n.cat-export button {\n  padding: 0;\n  padding-left: 2px; }\n\n.cat-progress {\n  width: 100%;\n  height: 20px; }\n\n.cat-slider-bar {\n  position: relative;\n  padding: 0 5px;\n  width: calc(100% - 20px);\n  height: 5px;\n  margin: 7.5px 8px;\n  background: white;\n  border-radius: 2.5px; }\n\n.cat-thumb {\n  width: 12px;\n  height: 12px;\n  box-sizing: border-box;\n  border: 1px solid white;\n  background: black;\n  border-radius: 100%;\n  cursor: pointer;\n  position: absolute;\n  font-smoothing: antialiased;\n  right: 0px;\n  transform: translate3d(5px, -4px, 0);\n  z-index: 10; }\n\n.cat-current-progress {\n  background: #aaa;\n  border-radius: 2.5px;\n  position: absolute;\n  left: 0;\n  width: 0;\n  height: 5px;\n  transition-property: width;\n  transition-timing-function: linear;\n  transition-duration: 0s; }\n  .cat-current-progress.active {\n    width: 100% !important; }\n\n#cat-start-page {\n  position: absolute;\n  left: 0;\n  top: 0;\n  width: 100%;\n  height: calc(100% + 42px);\n  -webkit-backdrop-filter: blur(1.5px);\n  backdrop-filter: blur(1.5px);\n  transition: .5s all;\n  cursor: pointer; }\n  #cat-start-page .play-btn {\n    position: absolute;\n    margin: auto;\n    left: 0;\n    top: 0;\n    right: 0;\n    bottom: 0;\n    width: 100px;\n    height: 100px;\n    transition: all .5s;\n    transform: scale(0);\n    opacity: 0; }\n    #cat-start-page .play-btn.show {\n      transform: scale(1);\n      opacity: 1; }\n'

    var FIXED_CSS =
        'textarea,\nbutton,\ndatalist,\nfieldset,\nform,\ninput,\nlabel,\nlegend,\nmeter,\noptgroup,\noption,\noutput,\nprogress,\nselect,\niframe {\n  pointer-events: none; }\n'

    function insertOrMoveNode(data, orderSet) {
        const { parentId, nextId, node } = data
        const parentNode = nodeStore.getNode(parentId)
        if (parentNode && isElementNode(parentNode)) {
            let nextNode = null
            if (nextId) {
                if (orderSet.has(nextId)) {
                    return true
                }
                nextNode = findNextNode(nextId)
                if (!nextNode) {
                    return true
                }
            }
            const n = node
            let insertNode
            if (typeof node === 'number') {
                insertNode = nodeStore.getNode(node)
                if (orderSet.has(node)) {
                    orderSet.delete(node)
                }
            } else if (isVNode(n)) {
                insertNode = convertVNode(n)
            } else {
                insertNode = createSpecialNode(n)
            }
            if (insertNode) {
                parentNode.insertBefore(insertNode, nextNode)
            }
        } else {
            return true
        }
    }
    function findNextNode(nextId) {
        return nextId ? nodeStore.getNode(nextId) : null
    }
    async function updateDom(Record) {
        const { type, data } = Record
        switch (type) {
            case RecordType.SNAPSHOT: {
                const snapshotData = data
                const { frameId } = snapshotData
                if (frameId) {
                    const iframeNode = nodeStore.getNode(frameId)
                    if (iframeNode) {
                        const contentDocument = iframeNode.contentDocument
                        createIframeDOM(contentDocument, snapshotData)
                        injectIframeContent(contentDocument, snapshotData)
                    }
                }
                break
            }
            case RecordType.SCROLL: {
                const { top, left, id } = data
                const target = id ? nodeStore.getNode(id) : this.c.sandBoxDoc.documentElement
                const curTop = target.scrollTop
                const behavior =
                    Math.abs(top - curTop) > window.__ReplayData__.snapshot.data.height * 3 ? 'auto' : 'smooth'
                target.scrollTo({
                    top,
                    left,
                    behavior
                })
                break
            }
            case RecordType.WINDOW: {
                const { width, height, id } = data
                let target
                if (id) {
                    target = nodeStore.getNode(id)
                    target.style.width = width + 'px'
                    target.style.height = height + 'px'
                } else {
                    target = this.c.sandBoxDoc.body
                    this.c.resize(width, height)
                }
                break
            }
            case RecordType.MOUSE: {
                const { x, y, id, type } = data
                let left = 0,
                    top = 0
                if (id) {
                    const node = nodeStore.getNode(id)
                    const { left: l, top: t } =
                        (node === null || node === void 0 ? void 0 : node.getBoundingClientRect()) || {}
                    left = l
                    top = t
                }
                if (type === MouseEventType.MOVE) {
                    this.pointer.move(x + left, y + top)
                } else if (type === MouseEventType.CLICK) {
                    this.pointer.click(x + left, y + top)
                }
                break
            }
            case RecordType.DOM: {
                await delay(200)
                const { addedNodes, movedNodes, removedNodes, attrs, texts } = data
                removedNodes.forEach(data => {
                    const { parentId, id } = data
                    const parentNode = nodeStore.getNode(parentId)
                    const node = nodeStore.getNode(id)
                    if (node && parentNode && parentNode.contains(node)) {
                        parentNode.removeChild(node)
                    }
                })
                const movedList = movedNodes.slice()
                const orderSet = new Set()
                movedList.forEach(data => {
                    if (data.nextId) {
                        if (movedList.some(a => a.id === data.nextId)) {
                            orderSet.add(data.nextId)
                        }
                    }
                })
                const addedList = movedList
                    .map(item => {
                        const { id, parentId, nextId } = item
                        return {
                            node: id,
                            parentId,
                            nextId
                        }
                    })
                    .concat(addedNodes.slice())
                const n = addedList.length
                const maxRevertCount = n > 0 ? (n * n + n) / 2 : 0
                let revertCount = 0
                while (addedList.length) {
                    const addData = addedList.shift()
                    if (addData) {
                        if (insertOrMoveNode(addData, orderSet)) {
                            if (revertCount++ < maxRevertCount) {
                                addedList.push(addData)
                            }
                        }
                    }
                }
                attrs.forEach(attr => {
                    const { id, key, value } = attr
                    const node = nodeStore.getNode(id)
                    if (node) {
                        setAttribute(node, key, value)
                    }
                })
                texts.forEach(text => {
                    const { id, value, parentId } = text
                    const parentNode = nodeStore.getNode(parentId)
                    const node = nodeStore.getNode(id)
                    if (parentNode && node) {
                        if (isExistingNode(node)) {
                            node.textContent = value
                            return
                        }
                        parentNode.innerText = value
                    }
                })
                break
            }
            case RecordType.FORM_EL: {
                await delay(200)
                const { id, key, type: formType, value, patches } = data
                const node = nodeStore.getNode(id)
                const { mode } = window.__ReplayOptions__
                if (node) {
                    if (formType === FormElementEvent.INPUT || formType === FormElementEvent.CHANGE) {
                        if (patches && patches.length) {
                            const newValue = revertStrByPatches(node.value, patches)
                            node.value = newValue
                        } else if (key) {
                            node[key] = value
                        }
                    } else if (formType === FormElementEvent.FOCUS) {
                        if (mode === 'live') {
                            return
                        }
                        node.focus()
                    } else if (formType === FormElementEvent.BLUR) {
                        node.blur()
                    } else if (formType === FormElementEvent.PROP) {
                        if (key) {
                            node[key] = value
                        }
                    }
                }
                break
            }
            case RecordType.LOCATION: {
                const { path, hash, href, contextNodeId } = data
                const contextNode = nodeStore.getNode(contextNodeId)
                if (contextNode) {
                    const context = contextNode.ownerDocument.defaultView
                    context.__ReplayLocation__ = { ...context.__ReplayLocation__, ...{ path, hash, href } }
                }
                break
            }
            case RecordType.CANVAS: {
                const { src, id, strokes } = data
                const target = nodeStore.getNode(id)
                if (!target) {
                    return
                }
                const ctx = target.getContext('2d')
                if (src) {
                    const image = new Image()
                    image.src = src
                    image.onload = function () {
                        ctx.drawImage(this, 0, 0)
                    }
                } else {
                    async function createChain() {
                        function splitStrokes(strokesArray) {
                            const result = []
                            strokesArray.forEach(strokes => {
                                const len = strokes.length
                                const pivot = Math.floor(len / 2)
                                result.push(...[strokes.splice(0, pivot), strokes])
                            })
                            return result
                        }
                        for (const strokesArray of splitStrokes(splitStrokes([strokes]))) {
                            for (const stroke of strokesArray) {
                                const { name, args } = stroke
                                if (Array.isArray(args)) {
                                    if (name === 'drawImage') {
                                        args[0] = nodeStore.getNode(args[0])
                                    }
                                    ctx[name].apply(ctx, args)
                                } else {
                                    const value = args
                                    ctx[name] = value
                                }
                            }
                        }
                    }
                    createChain()
                }
            }
        }
    }
    function showStartMask() {
        const startPage = document.querySelector('#cat-start-page')
        startPage.setAttribute('style', '')
    }
    function showStartBtn() {
        const startPage = document.querySelector('#cat-start-page')
        const btn = startPage.querySelector('.play-btn')
        btn.classList.add('show')
        return btn
    }
    function removeStartPage() {
        const startPage = document.querySelector('#cat-start-page')
        startPage.parentElement.removeChild(startPage)
    }
    async function waitStart() {
        const btn = showStartBtn()
        return new Promise(r => {
            btn.addEventListener('click', async () => {
                btn.classList.remove('show')
                await delay(500)
                r()
            })
        })
    }
    function createIframeDOM(contentDocument, snapshotData) {
        contentDocument.open()
        const doctype = snapshotData.doctype
        const doc = `<!DOCTYPE ${doctype.name} ${doctype.publicId ? 'PUBLIC ' + '"' + doctype.publicId + '"' : ''} ${
            doctype.systemId ? '"' + doctype.systemId + '"' : ''
        }><html><head></head><body></body></html>`
        contentDocument.write(doc)
    }
    function injectIframeContent(contentDocument, snapshotData) {
        const content = convertVNode(snapshotData.vNode)
        if (content) {
            const head = content.querySelector('head')
            if (head) {
                const style = document.createElement('style')
                style.innerHTML = FIXED_CSS
                head.appendChild(style)
            }
            const documentElement = contentDocument.documentElement
            content.scrollLeft = snapshotData.scrollLeft
            content.scrollTop = snapshotData.scrollTop
            contentDocument.replaceChild(content, documentElement)
        }
    }

    class ContainerComponent {
        constructor() {
            this.init()
        }
        getSnapshotRecord() {
            return window.__ReplayData__.snapshot.data
        }
        init() {
            this.initTemplate()
            this.initSandbox()
            const { resize } = this.makeItResponsive(this.container)
            this.resize = resize
        }
        initSandbox() {
            this.sandBox = this.container.querySelector('#cat-sandbox')
            this.sandBoxDoc = this.sandBox.contentDocument
            createIframeDOM(this.sandBoxDoc, this.getSnapshotRecord())
            disableScrolling(this.sandBox.contentWindow.document)
            this.setViewState()
        }
        setViewState() {
            nodeStore.reset()
            injectIframeContent(this.sandBoxDoc, this.getSnapshotRecord())
        }
        initTemplate() {
            document.head.append(this.createStyle('cat-css', CSS))
            document.body.append(this.createContainer('cat-main', HTML))
        }
        createContainer(id, html) {
            const parser = new DOMParser()
            const el = parser.parseFromString(filteringTemplate(html), 'text/html').body.firstChild
            el.id = id
            el.style.width = this.getSnapshotRecord().width + 'px'
            el.style.height = this.getSnapshotRecord().height + 'px'
            el.style.display = 'none'
            return (this.container = el)
        }
        makeItResponsive(target) {
            const debounceResizeFn = debounce(resizeHandle, 500)
            window.addEventListener('resize', debounceResizeFn.bind(this))
            triggerResize()
            setTimeout(() => (this.container.style.opacity = '1'))
            this.container.style.display = 'block'
            function triggerResize(setWidth, setHeight) {
                resizeHandle({ target: window }, setWidth, setHeight)
            }
            function resizeHandle(e, setWidth, setHeight) {
                if (e && e.target instanceof Window) {
                    const { innerWidth: w, innerHeight: h } = e.target
                    scalePages(target, w, h, setWidth, setHeight)
                }
            }
            function scalePages(target, maxWidth, maxHeight, setWidth, setHeight) {
                const { mode: replayMode } = window.__ReplayOptions__ || {}
                const panelHeight = replayMode === 'live' ? 0 : 40 - 2
                const { width: targetWidth, height: targetHeight } = getPageSize(target)
                const scaleX = maxWidth / (setWidth || targetWidth)
                const scaleY = maxHeight / ((setHeight || targetHeight) + panelHeight)
                const scale = Math.min(scaleX > scaleY ? scaleY : scaleX, 1)
                const left =
                    ((setWidth || targetWidth) * scale - (setWidth || targetWidth)) / 2 +
                    (maxWidth - (setWidth || targetWidth) * scale) / 2
                const top = (maxHeight - (setHeight || targetHeight) - panelHeight * scale) / 2
                target.style.transform = `scale(${scale})`
                target.style.left = left + 'px'
                target.style.top = top + 'px'
                if (setWidth) {
                    target.style.width = setWidth + 'px'
                }
                if (setHeight) {
                    target.style.height = setHeight + 'px'
                }
            }
            function getPageSize(target) {
                return {
                    width: parseInt(target.style.width, 10),
                    height: parseInt(target.style.height, 10)
                }
            }
            return {
                resize: triggerResize
            }
        }
        createStyle(id, s) {
            const style = document.createElement('style')
            style.id = id
            style.innerHTML = s
            return style
        }
    }

    class KeyboardComponent {
        constructor(container) {
            this.c = container
            this.init()
        }
        init() {
            this.controller = this.c.container.querySelector('.cat-keyboard')
            this.playOrPauseBtn = this.c.container.querySelector('.play-or-pause')
            this.exportBtn = this.c.container.querySelector('.cat-export')
            this.exportBtn.addEventListener('click', this.export)
            this.controller.addEventListener('click', e => {
                if (e.target && e.target.type === 'button') {
                    const speed = Number(e.target.getAttribute('speed'))
                    this.dispatchPlay(speed)
                }
            })
            reduxStore.subscribe('player', state => {
                if (state) {
                    this.paly(state.speed)
                    this.setSpeed(state.speed)
                }
            })
            this.detectWindowIsActive()
        }
        dispatchPlay(speed = 0) {
            reduxStore.dispatch({
                type: PlayerTypes.SPEED,
                data: {
                    speed
                }
            })
        }
        detectWindowIsActive() {
            document.addEventListener(
                'visibilitychange',
                () => {
                    if (document.visibilityState === 'hidden') {
                        this.dispatchPlay()
                    }
                },
                false
            )
        }
        paly(speed) {
            if (speed !== 0) {
                this.playOrPauseBtn.innerText = '〓'
                this.playOrPauseBtn.setAttribute('style', 'letter-spacing: 1px;font-weight: bold;')
                this.playOrPauseBtn.removeAttribute('speed')
            } else {
                this.playOrPauseBtn.innerText = '▲'
                this.playOrPauseBtn.removeAttribute('style')
                this.playOrPauseBtn.setAttribute('speed', '1')
            }
        }
        setSpeed(speed) {
            const speedNodes = this.c.container.querySelectorAll('.speed')
            ;[...speedNodes].forEach(node => {
                node.removeAttribute('disabled')
            })
            const index = getBtnIndex(speed)
            function getBtnIndex(speed) {
                switch (speed) {
                    case 100:
                        return 2
                    case 10:
                        return 1
                    case 1:
                        return 0
                    default:
                        return 0
                }
            }
            if (index > -1) {
                speedNodes[index].setAttribute('disabled', '')
            }
        }
        async export() {
            const SDKScript = document.getElementById('time-cat')
            const initScript = document.getElementById('time-cat-init')
            const scriptList = []
            async function getScriptSource(scriptElement) {
                return (
                    scriptElement.textContent ||
                    (await getRawScriptContent(scriptElement.src.trim())) ||
                    scriptElement.src
                )
            }
            if (SDKScript) {
                const source = await getScriptSource(SDKScript)
                scriptList.push({
                    name: 'time-cat',
                    src: source
                })
            }
            if (initScript) {
                const source = await getScriptSource(initScript)
                scriptList.push({
                    name: 'time-cat-init',
                    src: source
                })
            }
            const replayOptions = window.__ReplayOptions__
            exportReplay({
                ...replayOptions,
                scripts: scriptList
            })
        }
    }

    class AnimationFrame {
        constructor(animate, fps = 60) {
            this.index = 0
            this.fps = fps
            this.animate = animate
        }
        start() {
            let then = performance.now()
            const interval = 1000 / this.fps
            const tolerance = 0.1
            const animateLoop = now => {
                this.requestID = requestAnimationFrame(animateLoop)
                const delta = now - then
                if (delta >= interval - tolerance) {
                    then = now - (delta % interval)
                    this.animate(delta, this.index++)
                }
            }
            this.requestID = requestAnimationFrame(animateLoop)
        }
        stop() {
            cancelAnimationFrame(this.requestID)
        }
    }

    class PlayerComponent {
        constructor(c, pointer, progress, broadcaster) {
            this.speed = 0
            this.recordIndex = 0
            this.frameIndex = 0
            this.lastPercentage = 0
            this.isFirstTimePlay = true
            this.frameInterval = 250
            this.elapsedTime = 0
            this.audioOffset = 500
            this.curViewDiffTime = 0
            this.subtitlesIndex = 0
            this.c = c
            this.pointer = pointer
            this.progress = progress
            this.broadcaster = broadcaster
            this.audioNode = new Audio()
            this.initViewState()
            if (!this.records.length) {
                window.addEventListener('record-data', this.streamHandle.bind(this))
            } else {
                reduxStore.subscribe('player', state => {
                    if (state) {
                        this.progressState = reduxStore.getState('progress')
                        const speed = state.speed
                        this.speed = speed
                        this.frames = this.getAccuratelyFrame()
                        if (speed > 0) {
                            this.play()
                        } else {
                            this.pause()
                        }
                        this.setProgress()
                    }
                })
            }
        }
        initAudio() {
            if (!this.audioData) {
                return
            }
            if (this.audioData.src) {
                this.audioBlobUrl = location.href.split('/').slice(0, -1).join('/') + '/' + this.audioData.src
            } else {
                const bufferStrList = this.audioData.bufferStrList
                if (!bufferStrList.length) {
                    return
                }
                const dataArray = []
                for (let i = 0; i < bufferStrList.length; i++) {
                    const data = base64ToFloat32Array(bufferStrList[i])
                    dataArray.push(data)
                }
                const audioBlob = encodeWAV(dataArray, this.audioData.opts)
                const audioBlobUrl = URL.createObjectURL(audioBlob)
                this.audioBlobUrl = audioBlobUrl
            }
        }
        streamHandle(e) {
            const frame = e.detail
            if (isSnapshot(frame)) {
                window.__ReplayData__.snapshot = frame
                this.c.setViewState()
                return
            }
            this.execFrame(frame)
        }
        initViewState() {
            const { __ReplayPacks__: packs } = window
            const firstPack = packs[0]
            const firstData = firstPack.body[0]
            this.records = firstData.records
            this.audioData = firstData.audio
            this.initAudio()
            if (!this.records.length) {
                return
            }
            this.subtitlesIndex = 0
            this.broadcaster.cleanText()
            this.curViewEndTime = +this.records.slice(-1)[0].time
            this.curViewDiffTime = 0
            window.__ReplayData__ = firstData
        }
        async switchNextView(delayTime) {
            const { __ReplayData__: rData, __ReplayPacks__: packs } = window
            if (!this.records) {
                return
            }
            const nextData = getNextData(rData)
            if (!nextData) {
                return
            }
            function getNextData(curData) {
                var _a
                for (let i = 0; i < packs.length; i++) {
                    const body = packs[i].body
                    const nextPackBody = (_a = packs[i + 1]) === null || _a === void 0 ? void 0 : _a.body
                    for (let j = 0; j < body.length; j++) {
                        if (curData === body[j]) {
                            const next = body[j + 1]
                            if (next) {
                                return next
                            } else if (nextPackBody.length) {
                                return nextPackBody[0]
                            }
                            return null
                        }
                    }
                }
                return null
            }
            const curEndTime = +this.records.slice(-1)[0].time
            const nextStartTime = +nextData.records[0].time
            this.curViewDiffTime += nextStartTime - curEndTime
            window.__ReplayData__ = nextData
            this.records = nextData.records
            this.audioData = nextData.audio
            this.initAudio()
            this.curViewEndTime = +this.records.slice(-1)[0].time
            this.recordIndex = 0
            if (delayTime) {
                await delay(delayTime)
            }
            this.c.setViewState()
        }
        play() {
            this.playAudio()
            if (this.recordIndex === 0) {
                this.progress.resetThumb()
                if (!this.isFirstTimePlay) {
                    this.initViewState()
                    this.c.setViewState()
                }
                this.isFirstTimePlay = false
            }
            if (this.RAF && this.RAF.requestID) {
                this.RAF.stop()
            }
            const maxFps = 30
            this.RAF = new AnimationFrame(loop.bind(this), maxFps)
            this.RAF.start()
            const initTime = getTime()
            this.startTime = 0
            async function loop(t, loopIndex) {
                const timeStamp = getTime() - initTime
                if (this.frameIndex > 0 && !this.frames[this.frameIndex]) {
                    this.stop()
                    return
                }
                if (!this.startTime) {
                    this.startTime = Number(this.frames[this.frameIndex])
                }
                const currTime = this.startTime + timeStamp * this.speed
                let nextTime = Number(this.frames[this.frameIndex])
                if (nextTime > this.curViewEndTime - this.curViewDiffTime) {
                    await this.switchNextView(200)
                }
                while (nextTime && currTime >= nextTime) {
                    this.renderEachFrame()
                    this.frameIndex++
                    nextTime = Number(this.frames[this.frameIndex])
                }
                this.elapsedTime = (currTime - this.frames[0]) / 1000
                const frameCount = Math.floor(2 / (this.frameInterval / 1000))
                const checkInterval = !(this.frameIndex % frameCount)
                const shouldCheckAudioTime = this.audioNode.src && checkInterval && !((loopIndex % frameCount) * 2)
                if (shouldCheckAudioTime) {
                    const allowDiff = 200
                    if (
                        Math.abs((this.elapsedTime - this.audioNode.currentTime) * 1000) >
                        this.audioOffset + allowDiff
                    ) {
                        this.syncAudioCurrentTime()
                    }
                }
            }
        }
        playAudio() {
            if (!this.audioData) {
                return
            }
            if (!this.audioBlobUrl) {
                this.pauseAudio()
                return
            }
            if (this.audioNode) {
                if (!this.audioNode.src || this.audioNode.src !== this.audioBlobUrl) {
                    this.audioNode.src = this.audioBlobUrl
                }
                this.syncAudioCurrentTime()
                if (this.speed > 1) {
                    this.audioNode.pause()
                } else {
                    this.audioNode.play()
                }
            }
        }
        syncAudioCurrentTime(elapsedTime = this.elapsedTime, offset = this.audioOffset / 1000) {
            this.audioNode.currentTime = elapsedTime + offset
        }
        pauseAudio() {
            if (this.audioNode) {
                this.audioNode.pause()
            }
        }
        setProgress() {
            this.progress.setProgressAnimation(this.frameIndex, this.frames.length, this.frameInterval, this.speed)
        }
        renderEachFrame() {
            this.progress.updateTimer(((this.frameIndex + 1) * this.frameInterval) / 1000)
            let data
            while (
                this.recordIndex < this.records.length &&
                +(data = this.records[this.recordIndex]).time - this.curViewDiffTime <= this.frames[this.frameIndex]
            ) {
                this.execFrame.call(this, data)
                this.recordIndex++
            }
            if (this.audioData && this.audioData.subtitles.length) {
                const subtitles = this.audioData.subtitles
                const { start, end, text } = subtitles[this.subtitlesIndex]
                const audioStartTime = toTimeStamp(start)
                const audioEndTime = toTimeStamp(end)
                if (this.elapsedTime > audioEndTime / 1000) {
                    this.broadcaster.cleanText()
                    if (this.subtitlesIndex < subtitles.length - 1) {
                        this.subtitlesIndex++
                    }
                } else if (this.elapsedTime > audioStartTime / 1000) {
                    this.broadcaster.updateText(text)
                }
            }
        }
        pause() {
            if (this.RAF) {
                this.RAF.stop()
            }
            reduxStore.dispatch({
                type: PlayerTypes.SPEED,
                data: {
                    speed: 0
                }
            })
            this.pauseAudio()
        }
        stop() {
            this.speed = 0
            this.recordIndex = 0
            this.frameIndex = 0
            this.lastPercentage = 0
            this.elapsedTime = 0
            this.pause()
            this.audioNode.currentTime = 0
        }
        execFrame(record) {
            setTimeout(() => updateDom.call(this, record), 0)
        }
        getPercentInterval() {
            const k = 0.08
            const b = 0.2
            return this.speed * k + b
        }
        getAccuratelyFrame(interval = this.frameInterval) {
            this.progressState = reduxStore.getState()['progress']
            const { startTime, endTime } = this.progressState
            const s = +startTime
            const e = +endTime
            const result = []
            for (let i = s; i < e; i += interval) {
                result.push(i)
            }
            result.push(e)
            return result
        }
    }

    class PointerComponent {
        constructor() {
            this.x = 0
            this.y = 0
            this.initPointer()
        }
        initPointer() {
            this.pointer = document.getElementById('cat-pointer')
            this.move(0, 0)
        }
        move(x, y) {
            this.x = x
            this.y = y
            this.pointer.style.left = this.x + 'px'
            this.pointer.style.top = this.y + 'px'
        }
        async click(x, y) {
            this.move(x, y)
            if (this.pointer.hasAttribute('active')) {
                return
            }
            await delay(100)
            setAttribute(this.pointer, 'active', '')
            await delay(400)
            setAttribute(this.pointer, 'active', null)
        }
    }

    class ProgressComponent {
        constructor(c) {
            this.progress = c.container.querySelector('.cat-progress')
            this.timer = c.container.querySelector('.cat-timer time')
            this.thumb = this.progress.querySelector('.cat-thumb')
            this.currentProgress = this.progress.querySelector('.cat-current-progress')
            this.slider = this.progress.querySelector('.cat-slider-bar')
        }
        async setProgressAnimation(index, total, interval, speed) {
            if (!index && !speed) {
                return
            }
            this.currentProgress.classList.remove('active')
            await delay(20)
            this.currentProgress.style.removeProperty('transition')
            if (!speed) {
                this.currentProgress.style.width = this.currentProgress.offsetWidth + 'px'
                this.currentProgress.style.setProperty('transition', 'none')
                return
            }
            const duration = ((total - index) * interval) / speed / 1000
            this.currentProgress.style.transitionDuration = duration + 's'
            this.currentProgress.classList.add('active')
        }
        updateTimer(second) {
            const t = secondToDate(second)
            if (t) {
                this.timer.innerHTML = t
            }
        }
        resetThumb() {
            this.currentProgress.classList.remove('active')
            const currentProgress = this.currentProgress.cloneNode(true)
            this.currentProgress.parentNode.replaceChild(currentProgress, this.currentProgress)
            currentProgress.style.width = '0'
            this.currentProgress = currentProgress
        }
    }

    class BroadcasterComponent {
        constructor() {
            this.init()
        }
        init() {
            this.broadcaster = document.querySelector('.cat-broadcaster')
            this.floatLayer = this.broadcaster.firstElementChild
            this.subtitle = this.floatLayer.firstElementChild
        }
        updateText(text) {
            text = text.trim()
            if (this.subtitle.innerText.trim() === text) {
                return
            }
            this.subtitle.innerText = text
            this.floatLayer.toggleAttribute('hidden', !text)
        }
        cleanText() {
            this.updateText('')
        }
    }

    class Panel {
        constructor(container) {
            this.container = container
            this.initComponent()
        }
        initComponent() {
            this.keyboard = new KeyboardComponent(this.container)
            this.progress = new ProgressComponent(this.container)
            this.pointer = new PointerComponent()
            this.broadcaster = new BroadcasterComponent()
            this.player = new PlayerComponent(this.container, this.pointer, this.progress, this.broadcaster)
        }
    }

    var smoothscroll = createCommonjsModule(function (module, exports) {
        /* smoothscroll v0.4.4 - 2019 - Dustan Kasten, Jeremias Menichelli - MIT License */
        ;(function () {
            // polyfill
            function polyfill() {
                // aliases
                var w = window
                var d = document

                // return if scroll behavior is supported and polyfill is not forced
                if ('scrollBehavior' in d.documentElement.style && w.__forceSmoothScrollPolyfill__ !== true) {
                    return
                }

                // globals
                var Element = w.HTMLElement || w.Element
                var SCROLL_TIME = 468

                // object gathering original scroll methods
                var original = {
                    scroll: w.scroll || w.scrollTo,
                    scrollBy: w.scrollBy,
                    elementScroll: Element.prototype.scroll || scrollElement,
                    scrollIntoView: Element.prototype.scrollIntoView
                }

                // define timing method
                var now = w.performance && w.performance.now ? w.performance.now.bind(w.performance) : Date.now

                /**
                 * indicates if a the current browser is made by Microsoft
                 * @method isMicrosoftBrowser
                 * @param {String} userAgent
                 * @returns {Boolean}
                 */
                function isMicrosoftBrowser(userAgent) {
                    var userAgentPatterns = ['MSIE ', 'Trident/', 'Edge/']

                    return new RegExp(userAgentPatterns.join('|')).test(userAgent)
                }

                /*
                 * IE has rounding bug rounding down clientHeight and clientWidth and
                 * rounding up scrollHeight and scrollWidth causing false positives
                 * on hasScrollableSpace
                 */
                var ROUNDING_TOLERANCE = isMicrosoftBrowser(w.navigator.userAgent) ? 1 : 0

                /**
                 * changes scroll position inside an element
                 * @method scrollElement
                 * @param {Number} x
                 * @param {Number} y
                 * @returns {undefined}
                 */
                function scrollElement(x, y) {
                    this.scrollLeft = x
                    this.scrollTop = y
                }

                /**
                 * returns result of applying ease math function to a number
                 * @method ease
                 * @param {Number} k
                 * @returns {Number}
                 */
                function ease(k) {
                    return 0.5 * (1 - Math.cos(Math.PI * k))
                }

                /**
                 * indicates if a smooth behavior should be applied
                 * @method shouldBailOut
                 * @param {Number|Object} firstArg
                 * @returns {Boolean}
                 */
                function shouldBailOut(firstArg) {
                    if (
                        firstArg === null ||
                        typeof firstArg !== 'object' ||
                        firstArg.behavior === undefined ||
                        firstArg.behavior === 'auto' ||
                        firstArg.behavior === 'instant'
                    ) {
                        // first argument is not an object/null
                        // or behavior is auto, instant or undefined
                        return true
                    }

                    if (typeof firstArg === 'object' && firstArg.behavior === 'smooth') {
                        // first argument is an object and behavior is smooth
                        return false
                    }

                    // throw error when behavior is not supported
                    throw new TypeError(
                        'behavior member of ScrollOptions ' +
                            firstArg.behavior +
                            ' is not a valid value for enumeration ScrollBehavior.'
                    )
                }

                /**
                 * indicates if an element has scrollable space in the provided axis
                 * @method hasScrollableSpace
                 * @param {Node} el
                 * @param {String} axis
                 * @returns {Boolean}
                 */
                function hasScrollableSpace(el, axis) {
                    if (axis === 'Y') {
                        return el.clientHeight + ROUNDING_TOLERANCE < el.scrollHeight
                    }

                    if (axis === 'X') {
                        return el.clientWidth + ROUNDING_TOLERANCE < el.scrollWidth
                    }
                }

                /**
                 * indicates if an element has a scrollable overflow property in the axis
                 * @method canOverflow
                 * @param {Node} el
                 * @param {String} axis
                 * @returns {Boolean}
                 */
                function canOverflow(el, axis) {
                    var overflowValue = w.getComputedStyle(el, null)['overflow' + axis]

                    return overflowValue === 'auto' || overflowValue === 'scroll'
                }

                /**
                 * indicates if an element can be scrolled in either axis
                 * @method isScrollable
                 * @param {Node} el
                 * @param {String} axis
                 * @returns {Boolean}
                 */
                function isScrollable(el) {
                    var isScrollableY = hasScrollableSpace(el, 'Y') && canOverflow(el, 'Y')
                    var isScrollableX = hasScrollableSpace(el, 'X') && canOverflow(el, 'X')

                    return isScrollableY || isScrollableX
                }

                /**
                 * finds scrollable parent of an element
                 * @method findScrollableParent
                 * @param {Node} el
                 * @returns {Node} el
                 */
                function findScrollableParent(el) {
                    while (el !== d.body && isScrollable(el) === false) {
                        el = el.parentNode || el.host
                    }

                    return el
                }

                /**
                 * self invoked function that, given a context, steps through scrolling
                 * @method step
                 * @param {Object} context
                 * @returns {undefined}
                 */
                function step(context) {
                    var time = now()
                    var value
                    var currentX
                    var currentY
                    var elapsed = (time - context.startTime) / SCROLL_TIME

                    // avoid elapsed times higher than one
                    elapsed = elapsed > 1 ? 1 : elapsed

                    // apply easing to elapsed time
                    value = ease(elapsed)

                    currentX = context.startX + (context.x - context.startX) * value
                    currentY = context.startY + (context.y - context.startY) * value

                    context.method.call(context.scrollable, currentX, currentY)

                    // scroll more if we have not reached our destination
                    if (currentX !== context.x || currentY !== context.y) {
                        w.requestAnimationFrame(step.bind(w, context))
                    }
                }

                /**
                 * scrolls window or element with a smooth behavior
                 * @method smoothScroll
                 * @param {Object|Node} el
                 * @param {Number} x
                 * @param {Number} y
                 * @returns {undefined}
                 */
                function smoothScroll(el, x, y) {
                    var scrollable
                    var startX
                    var startY
                    var method
                    var startTime = now()

                    // define scroll context
                    if (el === d.body) {
                        scrollable = w
                        startX = w.scrollX || w.pageXOffset
                        startY = w.scrollY || w.pageYOffset
                        method = original.scroll
                    } else {
                        scrollable = el
                        startX = el.scrollLeft
                        startY = el.scrollTop
                        method = scrollElement
                    }

                    // scroll looping over a frame
                    step({
                        scrollable: scrollable,
                        method: method,
                        startTime: startTime,
                        startX: startX,
                        startY: startY,
                        x: x,
                        y: y
                    })
                }

                // ORIGINAL METHODS OVERRIDES
                // w.scroll and w.scrollTo
                w.scroll = w.scrollTo = function () {
                    // avoid action when no arguments are passed
                    if (arguments[0] === undefined) {
                        return
                    }

                    // avoid smooth behavior if not required
                    if (shouldBailOut(arguments[0]) === true) {
                        original.scroll.call(
                            w,
                            arguments[0].left !== undefined
                                ? arguments[0].left
                                : typeof arguments[0] !== 'object'
                                ? arguments[0]
                                : w.scrollX || w.pageXOffset,
                            // use top prop, second argument if present or fallback to scrollY
                            arguments[0].top !== undefined
                                ? arguments[0].top
                                : arguments[1] !== undefined
                                ? arguments[1]
                                : w.scrollY || w.pageYOffset
                        )

                        return
                    }

                    // LET THE SMOOTHNESS BEGIN!
                    smoothScroll.call(
                        w,
                        d.body,
                        arguments[0].left !== undefined ? ~~arguments[0].left : w.scrollX || w.pageXOffset,
                        arguments[0].top !== undefined ? ~~arguments[0].top : w.scrollY || w.pageYOffset
                    )
                }

                // w.scrollBy
                w.scrollBy = function () {
                    // avoid action when no arguments are passed
                    if (arguments[0] === undefined) {
                        return
                    }

                    // avoid smooth behavior if not required
                    if (shouldBailOut(arguments[0])) {
                        original.scrollBy.call(
                            w,
                            arguments[0].left !== undefined
                                ? arguments[0].left
                                : typeof arguments[0] !== 'object'
                                ? arguments[0]
                                : 0,
                            arguments[0].top !== undefined
                                ? arguments[0].top
                                : arguments[1] !== undefined
                                ? arguments[1]
                                : 0
                        )

                        return
                    }

                    // LET THE SMOOTHNESS BEGIN!
                    smoothScroll.call(
                        w,
                        d.body,
                        ~~arguments[0].left + (w.scrollX || w.pageXOffset),
                        ~~arguments[0].top + (w.scrollY || w.pageYOffset)
                    )
                }

                // Element.prototype.scroll and Element.prototype.scrollTo
                Element.prototype.scroll = Element.prototype.scrollTo = function () {
                    // avoid action when no arguments are passed
                    if (arguments[0] === undefined) {
                        return
                    }

                    // avoid smooth behavior if not required
                    if (shouldBailOut(arguments[0]) === true) {
                        // if one number is passed, throw error to match Firefox implementation
                        if (typeof arguments[0] === 'number' && arguments[1] === undefined) {
                            throw new SyntaxError('Value could not be converted')
                        }

                        original.elementScroll.call(
                            this,
                            // use left prop, first number argument or fallback to scrollLeft
                            arguments[0].left !== undefined
                                ? ~~arguments[0].left
                                : typeof arguments[0] !== 'object'
                                ? ~~arguments[0]
                                : this.scrollLeft,
                            // use top prop, second argument or fallback to scrollTop
                            arguments[0].top !== undefined
                                ? ~~arguments[0].top
                                : arguments[1] !== undefined
                                ? ~~arguments[1]
                                : this.scrollTop
                        )

                        return
                    }

                    var left = arguments[0].left
                    var top = arguments[0].top

                    // LET THE SMOOTHNESS BEGIN!
                    smoothScroll.call(
                        this,
                        this,
                        typeof left === 'undefined' ? this.scrollLeft : ~~left,
                        typeof top === 'undefined' ? this.scrollTop : ~~top
                    )
                }

                // Element.prototype.scrollBy
                Element.prototype.scrollBy = function () {
                    // avoid action when no arguments are passed
                    if (arguments[0] === undefined) {
                        return
                    }

                    // avoid smooth behavior if not required
                    if (shouldBailOut(arguments[0]) === true) {
                        original.elementScroll.call(
                            this,
                            arguments[0].left !== undefined
                                ? ~~arguments[0].left + this.scrollLeft
                                : ~~arguments[0] + this.scrollLeft,
                            arguments[0].top !== undefined
                                ? ~~arguments[0].top + this.scrollTop
                                : ~~arguments[1] + this.scrollTop
                        )

                        return
                    }

                    this.scroll({
                        left: ~~arguments[0].left + this.scrollLeft,
                        top: ~~arguments[0].top + this.scrollTop,
                        behavior: arguments[0].behavior
                    })
                }

                // Element.prototype.scrollIntoView
                Element.prototype.scrollIntoView = function () {
                    // avoid smooth behavior if not required
                    if (shouldBailOut(arguments[0]) === true) {
                        original.scrollIntoView.call(this, arguments[0] === undefined ? true : arguments[0])

                        return
                    }

                    // LET THE SMOOTHNESS BEGIN!
                    var scrollableParent = findScrollableParent(this)
                    var parentRects = scrollableParent.getBoundingClientRect()
                    var clientRects = this.getBoundingClientRect()

                    if (scrollableParent !== d.body) {
                        // reveal element inside parent
                        smoothScroll.call(
                            this,
                            scrollableParent,
                            scrollableParent.scrollLeft + clientRects.left - parentRects.left,
                            scrollableParent.scrollTop + clientRects.top - parentRects.top
                        )

                        // reveal parent in viewport unless is fixed
                        if (w.getComputedStyle(scrollableParent).position !== 'fixed') {
                            w.scrollBy({
                                left: parentRects.left,
                                top: parentRects.top,
                                behavior: 'smooth'
                            })
                        }
                    } else {
                        // reveal element in viewport
                        w.scrollBy({
                            left: clientRects.left,
                            top: clientRects.top,
                            behavior: 'smooth'
                        })
                    }
                }
            }

            {
                // commonjs
                module.exports = { polyfill: polyfill }
            }
        })()
    })
    var smoothscroll_1 = smoothscroll.polyfill

    const defaultReplayOptions = { autoplay: true, mode: 'default' }
    class Player {
        constructor(options) {
            this.init(options)
        }
        async init(options) {
            const opts = { ...defaultReplayOptions, ...options }
            window.__ReplayOptions__ = opts
            smoothscroll.polyfill()
            const replayPacks = await this.getReplayData(opts)
            if (!replayPacks) {
                return
            }
            const { records, audio } = (window.__ReplayData__ = this.getFirstReplayData(replayPacks))
            const hasAudio = audio && (audio.src || audio.bufferStrList.length)
            const c = new ContainerComponent()
            new Panel(c)
            showStartMask()
            this.fmp = new FMP()
            this.fmp.ready(async () => {
                if (hasAudio) {
                    await waitStart()
                }
                removeStartPage()
                if (records.length) {
                    const firstRecord = records[0]
                    const replayPacks = window.__ReplayPacks__
                    const startTime = firstRecord.time
                    const endTime =
                        replayPacks.reduce((packAcc, pack) => {
                            return (
                                packAcc +
                                pack.body
                                    .map(replayData => replayData.records)
                                    .reduce((acc, records) => {
                                        return acc + (+records.slice(-1)[0].time - +records[0].time)
                                    }, 0)
                            )
                        }, 0) + +startTime
                    reduxStore.dispatch({
                        type: ProgressTypes.INFO,
                        data: {
                            frame: 0,
                            curTime: Number(startTime),
                            startTime: Number(startTime),
                            endTime,
                            length: records.length
                        }
                    })
                    if (opts.autoplay || hasAudio) {
                        reduxStore.dispatch({
                            type: PlayerTypes.SPEED,
                            data: { speed: 1 }
                        })
                    }
                }
            })
            if (!records.length) {
                const panel = document.querySelector('#cat-panel')
                if (panel) {
                    panel.setAttribute('style', 'display: none')
                }
            }
        }
        getFirstReplayData(replayPacks) {
            return replayPacks[0].body[0]
        }
        getGZipData() {
            const data = window.__ReplayStrPacks__
            if (!data) {
                return null
            }
            const codeArray = []
            const strArray = data.split('')
            for (let i = 0; i < strArray.length; i++) {
                const num = strArray[i].charCodeAt(0)
                codeArray.push(num >= 300 ? num - 300 : num)
            }
            const str = pako_1.ungzip(codeArray, {
                to: 'string'
            })
            const packs = JSON.parse(str)
            return packs
        }
        dispatchEvent(type, data) {
            event = new CustomEvent(type, { detail: data })
            window.dispatchEvent(event)
        }
        async fetchData(input, init) {
            return fetch(input, init).then(res => res.json())
        }
        async dataReceiver(receiver) {
            let replayPack
            let head
            const body = []
            const self = this
            return await new Promise(resolve => {
                receiver(data => {
                    if (replayPack) {
                        this.dispatchEvent('record-data', data)
                    } else {
                        if (!data) {
                            return
                        }
                        if (data.type === RecordType.HEAD) {
                            head = data.data
                        } else if (data && isSnapshot(data)) {
                            if (head && body) {
                                body.push({
                                    snapshot: data,
                                    records: [],
                                    audio: { src: '', bufferStrList: [], subtitles: [], opts: {} }
                                })
                                replayPack = {
                                    head,
                                    body
                                }
                                resolve([replayPack])
                                if (self.fmp) {
                                    self.fmp.observe()
                                }
                            }
                        } else {
                            return
                        }
                    }
                })
            })
        }
        async getDataFromDB() {
            const DBOperator = await getDBOperator
            const data = await DBOperator.readAllRecords()
            if (data) {
                return classifyRecords(data)
            }
            return null
        }
        async getReplayData(options) {
            const { receiver, replayPacks: data, fetch } = options
            const rawReplayPacks =
                data ||
                (fetch && (await this.fetchData(fetch.url, fetch.options))) ||
                (receiver && (await this.dataReceiver(receiver))) ||
                this.getGZipData() ||
                (await this.getDataFromDB()) ||
                window.__ReplayPacks__
            if (!rawReplayPacks) {
                throw logError('Replay data not found')
            }
            const replayPacks = this.decodePacks(rawReplayPacks)
            if (replayPacks) {
                window.__ReplayPacks__ = replayPacks
                return replayPacks
            }
            return null
        }
        decodePacks(packs) {
            const { atob } = radix64
            packs.forEach(pack => {
                pack.body.forEach(data => {
                    const { records, snapshot } = data
                    snapshot.time = snapshot.time.length < 8 ? atob.call(radix64, snapshot.time) + '' : snapshot.time
                    records.forEach(record => {
                        record.time = record.time.length < 8 ? atob.call(radix64, record.time) + '' : record.time
                    })
                })
            })
            return packs
        }
    }

    const version$1 = '1.2.0-alpha.2'

    exports.Player = Player
    exports.Recorder = Recorder
    exports.exportReplay = exportReplay
    exports.version = version$1

    return exports
})({})

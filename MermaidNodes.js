"use strict";
const debug = require('debug')('MermaidNodes')
const mermaidConfig = require('./mermaid-config')

let idSource = "unset"
let nameSource = "unset"
let idTarget = "unset"
let nameTarget = "unset"

/**
 *cleanName: Removes all parenthesis marks from input string.
 *  Mermaid labels cannot contain parens
 *
 * @param {*} inName
 * @returns modified string (no parens)
 */
function cleanName(inName) {
    let cleanName = inName
    cleanName = cleanName.replace(/\(/g, "").replace(/\)/g, "")
    return(cleanName.replace(/\"/g,""))
}

/**
 *removeSpaces: Deletes all spaces from the specified string. 
 * Mermaid Class names cannot contain strings
 *
 * @param {*} text
 * @returns modified string (no spaces)
 */
function removeSpaces(text) {
    return (text.replace(/\s/g, ""))
}

const RED_STATUSES = ['ICEBOX', 'DEFINED', 'IN PROGRESS', 'IN REVIEW', 'DONE', 'EMERGENCY', 'BLOCKED', 'DEAD']

class MermaidNodes {
    /**
     *Creates an instance of MermaidNodes.
     * @memberof MermaidNodes
     */
    constructor() {
        debug("mermaidNodes created")
        this.nodes = []
        this.statuses = {}

        RED_STATUSES.forEach((status) => {
            this.statuses[status] = []
        })
    }

    /**
     *addLink: Update the list of nodes with the specified source and target details
     *
     * @param {*} idSource
     * @param {*} nameSource
     * @param {*} idTarget
     * @param {*} nameTarget
     * @param {*} statusTarget: Used to track the IDs by Status
     * @memberof MermaidNodes
     */
    addLink(idSource, nameSource, idTarget, nameTarget, statusTarget) {
        debug("node created")
        this.nodes.push({ idSource: idSource, nameSource: nameSource, idTarget: idTarget, nameTarget: cleanName(nameTarget) })
        this.appendStatus(idTarget, statusTarget)
    }

    /**
     *appendStatus: Update the status array with the specified ID and Status
     *
     * @param {*} id
     * @param {*} status
     * @memberof MermaidNodes
     */
    appendStatus(id, status) {
        if (!this.statuses[status]) {
            this.statuses[status] = []
        }
        this.statuses[status].push(id)
    }

    /**
     *setRootName: Corrects or updates name of the root Defaults to 0
     *
     * @param {*} name
     * @memberof MermaidNodes
     */
    setRootIdAndName(id, name) {
        debug(`setRootIdAndName(${id}, ${name}) called...`)
        name = cleanName(name)
        this.nodes.forEach((node) => {
            if (node.idSource == 0) {
                node.isSource = id
                node.nameSource = name
            } else if (node.idTarget == 0) {
                node.isTarget = id
                node.nameTarget = name
            }
        })
    }

    /**
     *getContent: Create the Mermaid file content from the stored data
     *
     * @returns Mermaid-formatted text
     * @memberof MermaidNodes
     */
    getContent() {
        let resp = []
        resp.push("graph LR;")

        resp.push("") // For readability
        this.nodes.forEach((node) => {
            resp.push(`  ${node.idSource}(${node.nameSource})-->${node.idTarget}(${node.nameTarget});`)
        })

        resp.push("") // Need a blank line before the Class definitions
        for (var f in mermaidConfig.formats) {
            if (mermaidConfig.formats.hasOwnProperty(f)) {
                resp.push(`classDef ${removeSpaces(f)} ${mermaidConfig.formats[f]}`)
            }
        }

        resp.push("") // Need a blank line before the id/status list
        for (var s in this.statuses) {
            if (this.statuses[s].length > 0) {
                resp.push(`class ${this.statuses[s].join(',')} ${removeSpaces(s)}`)
            }
        }

        // Merge all the results and return it
        return (resp.join("\n"))
    }
}

module.exports = MermaidNodes;

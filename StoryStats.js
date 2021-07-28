/** @format */

'use strict'

const config = require('config')
const path = require('path')
const os = require('os')
const fs = require('fs')
const debug = require('debug')('StoryStats')

class StoryStats {
  constructor(dbFilename = `${config.dataPath}${path.sep}jira-stats.db`) {
    if (fs.existsSync(dbFilename)) {
      this.db = require('better-sqlite3')(dbFilename, { readonly: true })
    } else {
      console.error(`Couldn't find db file (${dbFilename}).`)
      process.exit(10)
    }
  }

  /**
   * Fetch the list of seen Components
   *
   * @param {boolean} [forceRefresh=false] Always refresh the list?
   * @returns {array} List of components (alphabetically sorted)
   * @memberof StoryStats
   */
  getComponentList(forceRefresh = false) {
    if (forceRefresh || !this.components || this.components.length == 0) {
      this.components = []

      // Get the complete list of components in the db
      let results = this.db.prepare(
        `SELECT DISTINCT Component FROM 'story-stats' WHERE Component <> '' ORDER BY Component`
      ).all()

      results.forEach((c) => {
        if (c.component) {
          // Handle multiple components in one string
          let c2 = c.component.split(',')
          c2.forEach((c3) => {
            // Only add the component on first sighting
            if (!this.components.includes(c3)) {
              this.components.push(c3)
            }
          })
        }
      })
      this.components.sort()
    }
    return this.components
  }
}

module.exports = StoryStats

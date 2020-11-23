"use strict";

const debug = require("debug")("JDR");

const fs = require("fs");
const glob = require("glob");
const path = require("path");

const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60 * 24, checkperiod: 1200 });

const JiraDataCache = require("./JiraDataCache");

/**
 * Save cached data
 *
 * @class JiraDataReader
 */
class JiraDataReader {
  constructor() {
    this.cache = new JiraDataCache();
    this.loaded = this.cache.isActive();
    this.REBUILD = 999;
    this.REFRESH = 10;
    return this;
  }

  getCacheObject() {
    return this.cache;
  }

  rebuild() {
    return this.REBUILD;
  }
  refresh() {
    return this.REFRESH;
  }

  /**
   * Re-read the existing cache. The cache is not re-loaded or wiped.
   *
   * @param {*} [reloadType=this.REFRESH]
   * @returns
   * @memberof JiraDataReader
   */
  reloadCache(reloadType = this.REFRESH) {
    debug(`reloadCache(${reloadType}) called...`);
    let d = this.cache.getCache(true);
    let flist = glob.sync("./data/*.json");
    let updates = 0;
    if (reloadType == this.REBUILD) {
      this.clearCache();
    }
    flist.forEach((fname) => {
      if (reloadType == this.REBUILD || !this.cache.containsFile(fname)) {
        try {
          updates += 1;
          let raw = this._processFile(fname);
          d.push({
            fullname: fname,
            base: path.basename(fname, ".json"),
            status: this._parseStatusName(fname),
            date: this._parseFileDate(fname),
            total: raw.total,
            summary: raw.summary,
          });
        } catch (err) {
          console.error(`Error in reloadCache: ${err.message}`);
        }
      }
    });

    debug(`...saving cache (${updates} updates)`);
    this.cache.saveCache(d);
    this.loaded = this.cache.isActive();
    return updates;
  }

  /**
   * Read the cache & return the summary field or thrown an error
   *
   * @returns Summary field value
   * @memberof JiraDataReader
   */
  getDataSummary() {
    debug("getDataSummary() called...");
    if (!this.loaded) {
      this.processAllFiles();
    }

    try {
      let summary = this.cache.readCache(true, false);
      debug(`... returning summary`);
      return summary;
    } catch (err) {
      return err;
    }
  }

  /**
   * List all the dates read into the cache.
   *
   * @returns Array of dates (or empty if the cache isn't loaded)
   * @memberof JiraDataReader
   */
  getDates() {
    debug("getDates() called...");
    if (this.loaded) {
      // if (!this.dates) {
      this.dates = [];
      try {
        const interimCache = this.cache.readCache(true, false);
        interimCache.forEach((el, ndx) => {
          if (!this.dates.includes(el.date)) {
            this.dates.push(el.date);
          }
        });
      } catch (err) {
        debug(`... getDates() == Error during interimCache: ${err}`);
      }
      // }
      debug(`... getDates() == returning ${this.dates}`);
      return this.dates.sort();
    } else {
      debug("... getDates() == no data loaded");
      return [];
    }
  }

  /**
   * Get the cache data values.
   *
   * @param {boolean} [typeFilter=false]
   * @returns Series data object ({['type': dataArray}) (or empty if the cache isn't loaded)
   * @memberof JiraDataReader
   */
  getSeriesData(typeFilter = false) {
    debug(`getSeriesData(${typeFilter}) called...`);
    if (this.loaded) {
      this.seriesData = {};
      this.cache.readCache(true, false).forEach((el, ndx) => {
        if (!(el.status in this.seriesData)) {
          this.seriesData[el.status] = [];
        }
        if (typeFilter) {
          this.seriesData[el.status].push(el["summary"][typeFilter]["count"]);
        } else {
          this.seriesData[el.status].push(el.total);
        }
      });
      debug(`... getSeriesData() returning ok`);
      return this.seriesData;
    } else {
      debug("... getSeriesData() == no data loaded");
      return {};
    }
  }

  /**
   * List all the files read into the cache.
   *
   * @returns Array of filenames
   * @memberof JiraDataReader
   */
  getAllFiles() {
    if (!this.loaded) {
      this.processAllFiles();
    }
    return this.allFiles;
  }

  /**
   * Empty the cache. Does not re-build the cache.
   *
   * @returns JiraDataReader
   * @memberof JiraDataReader
   */
  clearCache() {
    this.cache.makeCache();
    this.loaded = this.cache.isActive();
    return this;
  }

  _parseStatusName(fname) {
    const bname = path.basename(fname, ".json");
    return bname.substring(0, bname.length - 11);
  }

  _parseFileDate(fname) {
    return fname.substring(fname.length - 15, fname.length - 5);
  }

  /**
   * Read in the data file from local disk and store it in the cache.
   *
   * @param {string} fname Input filename
   * @returns {object} Summary data object
   * @memberof JiraDataReader
   */
  _processFile(fname) {
    // debug(`_processFile(${fname}) called`);
    // The filename must be more than 16 characters long
    // Date + extension (.json) == 16 characters
    if (fname.length > 16) {
      // Log the filename and date
      this.lastFilename = fname;
      this.lastFiledate = this._parseFileDate(fname);

      let response = {};

      if (!cache.has(fname)) {
        let data = fs.readFileSync(fname);
        this.lastData = JSON.parse(data);
        // debug(`this.lastData.total = ${this.lastData.total}`);
        // Summarize data
        let summary = {
          Epic: { count: 0, issues: [] },
          Story: {
            count: 0,
            issues: [],
            aggregateprogress: { progress: 0, total: 0 },
          },
          Task: { count: 0, issues: [] },
          "Sub-task": { count: 0, issues: [] },
          Bug: { count: 0, issues: [] },
          Test: { count: 0, issues: [] },
          Requirement: { count: 0, issues: [] },
        };

        // Increment the counter and store the issue key
        this.lastData.issues.forEach((i) => {
          summary[i.fields.issuetype.name]["count"] += 1;
          summary[i.fields.issuetype.name]["issues"].push(i.key);

          // Update the running total of progress (spent) and total work estimates
          // No aggregateprogress field indicates no estimated/spent time
          // Only store for Stories, not Epics or Sub-Tasks - to avoid double-counting
          if (
            i.fields.issuetype.name === "Story" &&
            i.fields.aggregateprogress
          ) {
            summary[i.fields.issuetype.name].aggregateprogress.progress +=
              i.fields.aggregateprogress.progress;
            summary[i.fields.issuetype.name].aggregateprogress.total +=
              i.fields.aggregateprogress.total;
          }
        });

        // debug(summary["Story"].aggregateprogress);
        response = {
          total: this.lastData.total,
          raw: this.lastData,
          summary: summary,
        };

        // debug(`Saving ${fname} data to cache`);
        cache.set(fname, response);
      } else {
        // Get cache instead
        // debug(`Returning ${fname} data from cache`);
        response = cache.get(fname);
      }
      return response;
    } else {
      // Len <= 16
      throw new Error(`Invalid filename ${fname} (length: ${fname.length}`);
    }
  }
}

module.exports = JiraDataReader;

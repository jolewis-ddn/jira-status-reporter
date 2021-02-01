"use strict";

const debug = require("debug")("chart-link-maker");
// const config = require('config')

const randojs = require("@nastyox/rando.js"),
  rando = randojs.rando; //, randoSequence = randojs.randoSequence

const { convertSecondsToDays, removeSpaces } = require("./jiraUtils")

const BAR_CHART_TYPE = "bar";
const LINE_CHART_TYPE = "line";

const DEFAULT_CHART_TITLE = "";
const DEFAULT_CHART_TYPE = BAR_CHART_TYPE;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DEFAULT_FILL = false;

/** Structure
 * data = [
 *  { label: "label1",
 *    data: []
 *  }
 * ]
 * labels = []
 *
 * Size of labels must match # of data elements in data.data
 */

/**
 * Set any negative values to 0
 *
 * @param {array} arr
 * @returns {array} Updated array
 */
function removeNegatives(arr) {
  return arr.map((x) => (x >= 0 ? x : 0));
}

/**
 * Create an HTML string for a Billboard.js chart object
 *
 * @class ChartLinkMaker
 */
class ChartLinkMaker {
  constructor(
    newDataSeries,
    newDataCategories,
    chartType = DEFAULT_CHART_TYPE,
    w = DEFAULT_WIDTH,
    h = DEFAULT_HEIGHT,
    fill = DEFAULT_FILL
  ) {
    debug(
      `newDataSeries: ${newDataSeries}, newDataCateogries: ${newDataCategories}, w: ${w}, h: ${h}`
    );
    if (newDataSeries) {
      this.dataSeries = newDataSeries;
    } else {
      this.dataSeries = [];
    }

    if (newDataCategories) {
      this.dataCategories = newDataCategories;
    } else {
      this.dataCategories = [];
    }

    this.chartType = chartType;
    this.width = w;
    this.height = h;
    this.fill = fill;
    debug(
      `dataSeries: ${this.dataSeries}, dataCategories: ${this.dataCategories}, width: ${this.width}, height: ${this.height}, fill: ${this.fill}`
    );
    return this;
  }

  /**
   * Zero out any existing settings and data: i.e. all data series (reset to empty array), all categories (reset to empty array), chart type (reset to DEFAULT_CHART_TYPE), width (reset to DEFAULT_WIDTH) and height (reset to DEFAULT_HEIGHT), and fill (reset to DEFAULT_FILL).
   *
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  reset() {
    debug("reset() called");
    this.dataSeries = [];
    this.dataCategories = [];
    this.chartType = DEFAULT_CHART_TYPE;
    this.width = DEFAULT_WIDTH;
    this.height = DEFAULT_HEIGHT;
    this.fill = DEFAULT_FILL;
    return this;
  }

  /**
   * Set the chart type to bar chart
   *
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setBarChart() {
    debug("setBarChart() called");
    this.chartType = BAR_CHART_TYPE;
    return this;
  }

  /**
   * Set the chart type to line chart
   *
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setLineChart() {
    debug("setLineChart() called");
    this.chartType = LINE_CHART_TYPE;
    return this;
  }

  /**
   * Set the chart type to specified type.
   * Must be a chart type supported by Billboard.js
   *
   * @param {string} newType
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setChartType(newType) {
    debug(`setChartType(${newType}) called`);
    this.chartType = newType;
    return this;
  }

  /**
   * Set the chart height and width.
   *
   * @param {object} hw { h: 400, w: 600 }
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setSize(hw) {
    this.h = hw.h;
    this.w = hw.w;
    return this;
  }

  /**
   * Sset the chart height (pixels)
   *
   * @param {integer} h
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setHeight(h) {
    this.h = h;
    return this;
  }

  /**
   * Set the chart width (pixels)
   *
   * @param {integer} w
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setWidth(w) {
    this.w = w;
    return this;
  }

  /**
   * Set chart fill (for area charts)
   *
   * @param {*} newFill
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setFill(newFill) {
    debug(`setFill(${newFill}) called...`);
    this.fill = newFill;
    return this;
  }

  /**
   * Specify the data categories, replacing all existing categories.
   *
   * @param {array} cats
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  setCategories(cats) {
    debug(`setCategories(...${cats.length} items) called...`);
    this.dataCategories = cats;
    return this;
  }

  addCategory(cat) {
    debug(`addCategory(${cat}) called... Adding after ${this.dataCategories[this.dataCategories.length-1]}`)
    this.dataCategories.push(cat)
    return this
  }

  /**
   * Make sure the categories are valid and their sizes match the series length/size.
   *
   * @param {integer} [seriesSize=-1]
   * @returns {boolean}
   * @memberof ChartLinkMaker
   */
  _validateCategories(seriesSize = -1) {
    if (this.dataCategories) {
      if (this.dataCategories.length == seriesSize) {
        return true;
      } else {
        debug(`_validateCategories() failing...`);
        debug(this.dataCategories);
        throw new Error(
          `invalid data series provided: length mismatch. Received ${seriesSize} elements, but expected ${this.dataCategories.length}. Suggest wiping and rebuilding the cache`
        );
      }
    } else {
      throw new Error(
        "Must set categories using setCategories() call before adding series"
      );
    }
  }

  /**
   * Update the cache with a new data series
   *
   * @param {string} newLabel
   * @param {object} newData
   * @param {boolean} [ignoreValidation=false]
   * @returns ChartLinkMaker
   * @memberof ChartLinkMaker
   */
  addSeries(newLabel, newData, ignoreValidation = false) {
    debug(`addSeries(${newLabel}, ${newData}) called...`);
    try {
      if (ignoreValidation || this._validateCategories(newData.length)) {
        this.dataSeries.push({ label: newLabel, data: newData });
      }
      // debug(`... this.dataSeries now == ${JSON.stringify(this.dataSeries)}`)
    } catch (ex) {
      debug(`Exception caught: ${ex}`);
    }
    return this;
  }

  /**
   * Create the datasets object using the existing dataSeries data
   *
   * @returns {string} datasets
   * @memberof ChartLinkMaker
   */
  _buildDatasets() {
    debug(`_buildDatasets() called...`);
    let datasets = [];
    this.dataSeries.forEach((cat, ndx) => {
      debug(`...in forEach(${JSON.stringify(cat)}, ${ndx})...`);
      datasets.push({
        label: this.dataSeries[ndx].label,
        data: this.dataSeries[ndx].data,
        fill: this.fill,
      });
    });
    return JSON.stringify(datasets)
      .replace(/"([^"]+)":/g, "$1:")
      .replace(/"/g, "'");
  }

  getJson(data) {
    if (data) {
      // debug(data);
      const response = {};
      // debug(Object.keys(data).join(","));
      Object.keys(data).forEach(key => {
        response[removeSpaces(key)] = data[key]
      })
      response['x'] = `[${'^' + this.dataCategories.join('^,^') + '^'}]`
      return(JSON.stringify(response).replace(/"/g, '').replace(/\^/g, '"'))
    } else {
      throw new Error("getJson called without data");
    }
  }

  getGroups(data) {
    // debug(`getGroups called: `, data)
    return(JSON.stringify(`[${'^' + Object.keys(data).map((x) => removeSpaces(x)).join('^,^') + '^'}]`).replace(/"/g, '').replace(/\^/g, '"'))
  }

  enoughDataToPrintChart(data) {
    let goodToGo = false
    const k = Object.keys(data)
    if (k.length) { // Have entries
      // But are they non-zero
      let sumOfValues = 0
      for (let keyNdx = 0; keyNdx < k.length; keyNdx++) {
        let key = k[keyNdx]
      // k.forEach((key) => {
        debug(`...data[${key}]: (typeof: ${typeof data[key]})`, data[key])
        if (typeof data[key] == 'number') {
          sumOfValues += data[key]
        } else {
          sumOfValues += data[key].reduce((acc, cur) => { return acc + cur})
        }
        debug(`sumOfValues after ${key}: ${sumOfValues}`)
        if (sumOfValues) { return(true) }
      }
    }
    return(goodToGo)
  }

  /**
   * Create the HTML tag for a single chart
   *
   * @param {string} title
   * @param {object} data
   * @param {string} [chartType="area"]
   * @returns
   * @memberof ChartLinkMaker
   */
  async buildChartImgTag(title, data, chartType = "area", xLabel = "") {
    return new Promise((resolve, reject) => {
      // debug(
      //   `buildChartImgTag(${title}, data, ${chartType}) called with data: `,
      //   data, '; this.dataSeries: ', this.dataSeries
      // );
      if (!this.enoughDataToPrintChart(data)) { // No data in function call
        if (!this.dataSeries.length) { // No data previously provided, so return error msg
          resolve('<em>No data available</em>')
        } else {
          debug(`this.dataSeries.length: `, this.dataSeries.length)
        }
        // No data, so build from local data
        this.h = DEFAULT_HEIGHT;
        this.w = DEFAULT_WIDTH;
        // TODO: Set these via the config file
        let inReview = this.dataSeries.filter((x) => {
          return x.label == "IN REVIEW";
        })[0].data;
        let blocked = this.dataSeries.filter((x) => {
          return x.label == "BLOCKED";
        })[0].data;

        data = {
          Open: this.dataSeries.filter((x) => {
            return x.label == "DEFINED";
          })[0].data,
          Active: this.dataSeries
            .filter((x) => {
              return x.label == "IN PROGRESS";
            })[0]
            .data.map((num, idx) => {
              return num + inReview[idx];
            }),
          Closed: this.dataSeries.filter((x) => {
            return x.label == "DONE";
          })[0].data,
          Stopped: this.dataSeries
            .filter((x) => {
              return x.label == "EMERGENCY";
            })[0]
            .data.map((num, idx) => {
              return num + blocked[idx];
            }),
        };
      }
      if (!title) {
        title = DEFAULT_CHART_TITLE;
      }

      if (Object.keys(data)) {
        debug(`data keys: ${Object.keys(data).join(',')}`)
        let forecastType = ''
        let dataGroups = ""
        // Workaround for specifying stacked bar chart
        if (chartType === "stacked-bar") {
          if (Object.keys(data).includes("Forecast")) {
            const subData = {...data}
            delete subData["Forecast"]
            delete subData["Forecast_TeamSize"]
            dataGroups = `groups: [ ${this.getGroups(subData)} ],`

            forecastType = `types: { Forecast: "line", Forecast_TeamSize: "line" },`
          } else {
            dataGroups = `groups: [ ${this.getGroups(data)} ],`
          }
          chartType = "bar"
        }

        const subchartContent = chartType === "area" || chartType === "line" ? 'subchart: { show: true, }' : ''

        const id = rando(99999);
        let chartHtml = `<div id='chart-${id}' class='miniJSRChart'></div><script>
          var chart = bb.generate({
            bindto: "#chart-${id}",
            size: { height: ${this.h ? this.h : DEFAULT_HEIGHT}, width: ${
          this.w ? this.w : DEFAULT_WIDTH
        } },
            title: { text: '${title}' },
            axis: {
              ${xLabel ? 'y: { label: "' + xLabel + '" },' : '' }
              x: {
                type: "timeseries",
              }
            },
            bar: {
              width: {
                ratio: 0.9,
                max: 30
              }
            },
            data: {
              x: "x",
              type: "${chartType}",
              json: ${this.getJson(data)},
              ${forecastType}
              ${dataGroups}
            },
            color: { pattern: [ 'lightblue', 'MediumSeaGreen', 'CornflowerBlue', 'Pink', 'Orange' ] },
            xFormat: "%Y-%m-%d",
            ${subchartContent}
          });
        </script>`;
        resolve(chartHtml);
      } else {
        debug(`ERR in buildChartImgTag: No data set for ${title}`);
        reject("no data set");
      }
    });
  }
}

module.exports = ChartLinkMaker;

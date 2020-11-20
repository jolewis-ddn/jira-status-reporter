"use strict";

const debug = require("debug")("chart-link-maker");
// const config = require('config')

const randojs = require("@nastyox/rando.js"),
  rando = randojs.rando; //, randoSequence = randojs.randoSequence

const BAR_CHART_TYPE = "bar";
const LINE_CHART_TYPE = "line";

// const BASE_URL =
//   config.get('graphicServer.protocol') +
//   '://' +
//   config.get('graphicServer.server') +
//   ':' +
//   config.get('graphicServer.port')

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

function removeNegatives(arr) {
  return arr.map((x) => (x >= 0 ? x : 0));
}

/**
 * Make image tag
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

  setBarChart() {
    debug("setBarChart() called");
    this.chartType = BAR_CHART_TYPE;
    return this;
  }

  setLineChart() {
    debug("setLineChart() called");
    this.chartType = LINE_CHART_TYPE;
    return this;
  }

  setChartType(newType) {
    debug(`setChartType(${newType}) called`);
    this.chartType = newType;
    return this;
  }

  setSize(hw) {
    this.h = hw;
    this.w = hw;
    return this;
  }

  setFill(newFill) {
    debug(`setFill(${newFill}) called...`);
    this.fill = newFill;
    return this;
  }

  setCategories(cats) {
    debug(`setCategories(${cats}) called...`);
    this.dataCategories = cats;
    return this;
  }

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

  async buildChartImgTag(title, data, chartType = "area") {
    debug(
      `buildChartImgTag(${title}, data, ${chartType}) called with data: `,
      data
    );
    if (!data) {
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
    return new Promise((resolve, reject) => {
      if (data) {
        const id = rando(99999);
        let chartHtml = `<span id='chart-${id}' class='miniJSRChart'></span><script>
          var chart = bb.generate({
            bindto: "#chart-${id}",
            size: { height: ${this.h}, width: ${this.w} },
            title: { text: '${title}' },
            axis: {
              x: {
                type: "timeseries"
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
              json: {
                Open: [${removeNegatives(data.Open)}],
                Active: [${removeNegatives(data.Active)}],
                Closed: [${removeNegatives(data.Closed)}],
                Stopped: [${removeNegatives(data.Stopped)}],
                x: [${'"' + this.dataCategories.join('","') + '"'}]
              }
            },
            color: { pattern: [ 'SeaShell', 'MediumSeaGreen', 'CornflowerBlue', 'Pink' ] },
            xFormat: "%Y-%m-%d",
            subchart: { show: true, },
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

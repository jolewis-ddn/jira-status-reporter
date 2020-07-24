"use strict";

const debug = require('debug')('chart-link-maker')

const BAR_CHART_TYPE = 'bar'
const LINE_CHART_TYPE = 'line'

const BASE_URL = "http://prog-mgmt-apps:9000"
const DEFAULT_CHART_TYPE = BAR_CHART_TYPE
const DEFAULT_WIDTH = 500
const DEFAULT_HEIGHT = 300
const DEFAULT_FILL = false

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
 * Make image tag
 *
 * @class ChartLinkMaker
 */
class ChartLinkMaker {
    constructor(newDataSeries, newDataCategories, chartType = DEFAULT_CHART_TYPE, w = DEFAULT_WIDTH, h = DEFAULT_HEIGHT, fill = DEFAULT_FILL) {
        debug(`newDataSeries: ${newDataSeries}, newDataCateogries: ${newDataCategories}, w: ${w}, h: ${h}`)
        if (newDataSeries) { 
            this.dataSeries = newDataSeries
        } else {
            this.dataSeries = []
        }
        
        if (newDataCategories) { 
            this.dataCategories = newDataCategories 
        } else {
            this.dataCategories = []
        }

        this.chartType = chartType
        this.width = w
        this.height = h
        this.fill = fill
        debug(`dataSeries: ${this.dataSeries}, dataCategories: ${this.dataCategories}, width: ${this.width}, height: ${this.height}, fill: ${this.fill}`)
        return(this)
    }

    reset() {
        debug('reset() called')
        this.dataSeries = []        
        this.dataCategories = []
        this.chartType = DEFAULT_CHART_TYPE
        this.width = DEFAULT_WIDTH
        this.height = DEFAULT_HEIGHT
        this.fill = DEFAULT_FILL
        return(this)
    }

    setBarChart() { 
        debug('setBarChart() called')
        this.chartType = BAR_CHART_TYPE 
        return(this)
    }
    
    setLineChart() { 
        debug('setLineChart() called')
        this.chartType = LINE_CHART_TYPE 
        return(this)
    }

    setChartType(newType) { 
        debug(`setChartType(${newType}) called`)
        this.chartType = newType 
        return(this)
    }

    setFill(newFill) {
        this.fill = newFill 
        return(this)
    }

    setCategories(cats) {
        debug(`setCategories(${cats}) called...`)
        this.dataCategories = cats
        return(this)
    }

    _validateCategories(seriesSize = -1) {
        if (this.dataCategories) {
            if (this.dataCategories.length == seriesSize) {
                return(true)
            } else {
                throw new Error(`invalid data series provided: length mismatch. Received ${seriesSize} elements, but expected ${this.dataCategories.length}`)
            }
        } else {
            throw new Error("Must set categories using setCategories() call before adding series")
        }
    }

    addSeries(newLabel, newData) {
        debug(`addSeries(${newLabel}, ${newData}) called...`)
        if (this._validateCategories(newData.length)) {
            this.dataSeries.push({'label': newLabel, 'data': newData})
        }
        debug(`... this.dataSeries now == ${JSON.stringify(this.dataSeries)}`)
        return(this)
    }

    _buildDatasets() {
        debug(`_buildDatasets() called...`)
        let datasets = []
        this.dataSeries.forEach((cat, ndx) => {
            debug(`...in forEach(${JSON.stringify(cat)}, ${ndx})...`)
            datasets.push({ label: this.dataSeries[ndx]['label'], data: this.dataSeries[ndx]['data'], fill: this.fill })
        })
        return(JSON.stringify(datasets).replace(/"([^"]+)":/g, '$1:').replace(/"/g, "'"))
    }

    buildChartImgTag() {
        debug('buildChartImgTag() called...')
        return new Promise((resolve, reject) => {
            // Working tag:
            //  <img src="http://prog-mgmt-apps:9000/chart?width=500&height=300&c={type:'bar',data:{labels:['January','February','March','April','May'], datasets:[{label:'dogsY',data:[50,60,70,180,190]},{label:'catsX',data:[100,200,300,400,500]}]}}">

            let imgTag = `<img src="${BASE_URL}/chart?width=${this.width}&height=${this.height}&c={type:'${this.chartType}',data:{labels:['${this.dataCategories.join("','")}'], datasets:${this._buildDatasets()}}}">`
            resolve(imgTag)
        })
    }
}

module.exports = ChartLinkMaker

var xAxisDateStrings = [];

d3.csv('https://docs.google.com/spreadsheet/pub?key=0AqUvOryrtCYHdHREc3ZjTXpDRVRmZHgzMGZ0VHZwUWc&single=true&gid=0&output=csv',
  function onGettingCSV(error, rows) {
  console.log(rows);
  var csvArrays = csvRowObjectsToArrays(rows);
  console.log('csvArrays', csvArrays);
  setUpGraph(csvArrays);
});

function parseMMDDYY(dateString) {
  var dateParts = dateString.split('/');
  return new Date(dateParts[2], dateParts[0], dateParts[1])
}

function csvRowObjectsToArrays(rows) {
  var groups = [];
  var groupsForGroupNames = {};
  var groupKeys = [];
  if (rows.length < 1 || rows[0].length < 3) {
    return groups;
  }
  else {
    groupKeys = (_.keys(_.omit(rows[0], 'Date', 'Attacks')));
    _.each(groupKeys, function initGroupArray(groupKey) {
      groupsForGroupNames[groupKey] = [];
    });

    var startDate = new Date(rows[0].Date);
    var startTime = startDate.getTime();

    _.each(rows, function arrayFromRowObject(row) {
      var xDate = new Date(row.Date);
      var xTime = xDate.getTime();
      var daysElapsed = (xTime - startTime)/1000/(24 * 60 * 60);

      // Save the date string so the axis can use it later.
      xAxisDateStrings.push(xDate.toDateString());

      _.each(groupKeys, function putRowContentsIntoArrays(key) {
        groupsForGroupNames[key].push({
          x: daysElapsed,
          y: row[key] ? parseFloat(row[key]) : 0,
          y0: groupKeys.indexOf(key),
          labelText: key
        });
      })
    });
    groups = _.values(groupsForGroupNames);
  }
  return groups;
}

var layers = [];

function setUpGraph(stackData) {  
  var n = stackData.length, // number of layers
      m = stackData[0].length, // number of samples per layer
      stack = d3.layout.stack(),
      layers = stack(stackData),
      yGroupMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y; }); }),
      yStackMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y0 + d.y; }); });
  // console.log(stackData);
   
  var margin = {top: 40, right: 10, bottom: 20, left: 10},
      width = 960 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;
   
  var x = d3.scale.ordinal()
      .domain(d3.range(m))
      .rangeRoundBands([0, width], .08);
   
  var y = d3.scale.linear()
      .domain([0, yStackMax])
      .range([height, 0]);
   
  var color = d3.scale.linear()
      .domain([0, n - 1])
      .range(['#aad', '#556']);
   
  var xAxis = d3.svg.axis()
      .scale(x)
      .tickSize(0)
      .tickPadding(6)
      .orient('bottom')
      .tickValues(xAxisDateStrings);
   
  var svg = d3.select('body').append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
   
  var layer = svg.selectAll('.layer')
      .data(layers)
    .enter().append('g')
      .attr('class', 'layer')
      .style('fill', function(d, i) { return color(i); });
   
  var rect = layer.selectAll('rect')
      .data(function(d) { return d; })
    .enter().append('rect')
      .attr('x', function(d) { return x(d.x); })
      .attr('y', height)
      .attr('width', x.rangeBand())
      .attr('height', 0);

  var rectLabel = layer.selectAll('text')
    .data(function getLabelData(d) {
      return d;
    })
    .enter().append('text')
      .attr('x', function(d) { return x(d.x); })
      .attr('y', function(d) { return y(d.y); })
      .text(function getText(d) {
        return d.labelText;
      });

  rect.transition()
      .delay(function(d, i) { return i * 10; })
      .attr('y', function(d) { return y(d.y0 + d.y); })
      .attr('height', function(d) { return y(d.y0) - y(d.y0 + d.y); });

  svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(xAxis);
   
  d3.selectAll('input').on('change', change);

  function transitionGrouped() {
    y.domain([0, yGroupMax]);
 
    rect.transition()
      .duration(500)
      .delay(function(d, i) { return i * 10; })
      .attr('x', function(d, i, j) { return x(d.x) + x.rangeBand() / n * j; })
      .attr('width', x.rangeBand() / n)
    .transition()
      .attr('y', function(d) { return y(d.y); })
      .attr('height', function(d) { return height - y(d.y); });

    rectLabel.transition()
      .duration(500)
      .transition()
        .attr('height', function(d) { return 0; });
  }
   
  function transitionStacked() {
    y.domain([0, yStackMax]);
   
    rect.transition()
        .duration(500)
        .delay(function(d, i) { return i * 10; })
        .attr('y', function(d) { return y(d.y0 + d.y); })
        .attr('height', function(d) { return y(d.y0) - y(d.y0 + d.y); })
      .transition()
        .attr('x', function(d) { return x(d.x); })
        .attr('width', x.rangeBand());

    rectLabel.transition()
      .duration(500)
      .transition()
        .attr('height', function(d) { return 64; });
  }

  var timeout = setTimeout(function() {
    d3.select('input[value=\'grouped\']').property('checked', true).each(change);
  }, 2000);
   
  function change() {
    clearTimeout(timeout);
    if (this.value === 'grouped') transitionGrouped();
    else transitionStacked();
  }

}
 
 
// Inspired by Lee Byron's test data generator.
function bumpLayer(n, o) {
 
  function bump(a) {
    var x = 1 / (.1 + Math.random()),
        y = 2 * Math.random() - .5,
        z = 10 / (.1 + Math.random());
    for (var i = 0; i < n; i++) {
      var w = (i / n - y) * z;
      a[i] += x * Math.exp(-w * w);
    }
  }
 
  var a = [], i;
  for (i = 0; i < n; ++i) a[i] = o + o * Math.random();
  for (i = 0; i < 5; ++i) bump(a);
  return a.map(function(d, i) { return {x: i, y: Math.max(0, d)}; });
}

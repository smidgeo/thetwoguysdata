var xAxisDateStrings = [];

d3.csv(
  // 'Friendship%20chart%20(5).csv',
  'https://docs.google.com/spreadsheet/pub?key=0AqUvOryrtCYHdHREc3ZjTXpDRVRmZHgzMGZ0VHZwUWc&single=true&gid=0&output=csv',
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

      var currentCategory = null;
      var numberOfKeysInCategoryProcessed = 0;

      _.each(groupKeys, function putRowContentsIntoArrays(key) {
        // Use the key to find the category.
        var category = null;
        var keyParts = key.split(':');
        if (keyParts.length > 1) {
          category = keyParts[0];

          if (currentCategory === category) {
            numberOfKeysInCategoryProcessed += 1;
          }
          else {
            // We hit a new category.
            currentCategory = category;
            numberOfKeysInCategoryProcessed = 0;
          }
        }

        groupsForGroupNames[key].push({
          x: daysElapsed,
          y: row[key] ? parseFloat(row[key]) : 0,
          y0: groupKeys.indexOf(key),
          category: category,
          indexWithinCategory: numberOfKeysInCategoryProcessed,
          getLabelText: function getText(d) {
            var text = null;
            if (this.y > 0.01) {
              text = key;
            }
            return text;
          }
        });
      })
    });
    groups = _.values(groupsForGroupNames);
  }
  return groups;
}

var layers = [];

var bonusColor = d3.scale.ordinal().range(colorbrewer.Greens[5])
  // Favor the right side of the Greens array.
  .domain(d3.range(-2, 3));
var wilyColor = d3.scale.ordinal().range(colorbrewer.Oranges[5]);
var sharedColor = d3.scale.ordinal().range(colorbrewer.YlOrRd[7]);

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
   
  var xAxis = d3.svg.axis()
      .scale(x)
      .tickSize(0)
      .tickPadding(6)
      .orient('bottom')
      .tickValues(xAxisDateStrings);
   
  var svg = d3.select('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
   
  var layer = svg.selectAll('.layer')
      .data(layers)
    .enter().append('g')
      .attr('class', 'layer')
      .style('fill', function(d, i) { 
        var calculated = 'purple';
        var representatitveCell = d[0];

        if (representatitveCell && 
          (typeof representatitveCell.category === 'string')) {
          switch (representatitveCell.category) {
            case 'Bonus Cat':
              calculated = bonusColor(representatitveCell.indexWithinCategory);
              break;
            case 'Dr. Wily':
              calculated = wilyColor(representatitveCell.indexWithinCategory);
              break;
            case 'Shared':
              calculated = sharedColor(representatitveCell.indexWithinCategory);
              break;
            default:
              console.log('Could not find a color for', representatitveCell);
              // debugger;
          }
        }
        else {
          debugger;
        }
        return calculated; 
      });

  var textLayer = svg.selectAll('.textlayer')
      .data(layers)
    .enter().append('g')
      .attr('class', 'textlayer');
   
  var rect = layer.selectAll('rect')
      .data(function(d) { return d; })
    .enter().append('rect')
      .attr('x', function(d) { return x(d.x); })
      .attr('y', height)
      .attr('width', x.rangeBand())
      .attr('height', 0);

  var rectLabel = textLayer.selectAll('text')
    .data(function getLabelData(d) {
      return d;
    })
    .enter().append('text')
      .attr('x', function(d) { return x(d.x); })
      .attr('y', function(d) { return y(d.y); })
      .text(function getText(d) {
        return d.getLabelText();
      });

  transitionGrouped();

  svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(xAxis);
   
  d3.selectAll('input').on('change', change);

  function transitionGrouped() {
    y.domain([0, yGroupMax]);

    function getXOfGroupedDatum(d, i, j) { 
      return x(d.x) + x.rangeBand() / n * j; 
    }
    function getYOfGroupedDatum(d) {
      return y(d.y);
    }
 
    rect.transition()
      .duration(500)
      .delay(function(d, i) { return i * 10; })
      .attr('x', getXOfGroupedDatum)
      .attr('width', x.rangeBand() / n)
    .transition()
      .attr('y', getYOfGroupedDatum)
      .attr('height', function(d) { return height - y(d.y); });

    rectLabel.transition()
      .duration(500)
      .transition()
      .attr('x', getXOfGroupedDatum)
      .attr('y', function getLabelYOfGroupedDatum(d) {
        // We are setting this, keeping in mind this is going to be rotated 90º.
        return getYOfGroupedDatum(d) - (x.rangeBand() / n)/3;
      })
      .attr('transform', function(d, i, j) { 
        var rectX = getXOfGroupedDatum(d, i, j);
        var rectY = getYOfGroupedDatum(d);
        return 'rotate(90 ' + rectX + ' ' + rectY + ')'; 
      });
  }
   
  function transitionStacked() {
    y.domain([0, yStackMax]);

    function getHeightOfStackedDatum(d) { 
      return y(d.y0) - y(d.y0 + d.y); 
    }
    function getYOfStackedDatum(d) {
      return y(d.y0 + d.y); 
    }
   
    rect.transition()
        .duration(500)
        .delay(function(d, i) { return i * 10; })
        .attr('y', getYOfStackedDatum)
        .attr('height', getHeightOfStackedDatum)
      .transition()
        .attr('x', function(d) { return x(d.x); })
        .attr('width', x.rangeBand());

    rectLabel.transition()
      .duration(500)
      .transition()
        .attr('x', function(d) { return x(d.x); })
        .attr('y', function(d) { 
          return getYOfStackedDatum(d) + getHeightOfStackedDatum(d)/2;
        })
        .attr('transform', function(d) { return 'rotate:(0) translate(0, 0)'; });
  }

  var timeout = setTimeout(function() {
    d3.select('input[value=\'stacked\']').property('checked', true).each(change);
  }, 2000);
   
  function change() {
    clearTimeout(timeout);
    if (this.value === 'grouped') transitionGrouped();
    else transitionStacked();
  }

}
 

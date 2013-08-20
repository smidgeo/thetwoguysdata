var Session = {
  dateOfLastAttack: null,
  dateOfLastHiss: null,
  csvArraysForColumns: {},
};

var Settings = {
  labelMargin: 6,
  preferredCategoryOrder: [
    'Bonus Cat',
    'Shared',
    'Hostility',
    'Dr. Wily'
  ],
  preferredActivityOrders: {
    'Bonus Cat': [
      'Lazy get',
      'Workout'
    ],
    'Hostility': [
      'Bonus Hiss',
      'Wily Attack'
    ],
    'Shared': [
      'Social Snacks',
      'Group Meal',
      'Turf Swap'
    ],
    'Dr. Wily': [
      'Workout',
      'Walk outside',
      'Lazy gets'
    ]
  },
  stackedBarWidth: 100,
  // csvUrl: 'Friendship%20chart.csv',
  csvUrl: 'https://docs.google.com/spreadsheet/pub?key=0AqUvOryrtCYHdHREc3ZjTXpDRVRmZHgzMGZ0VHZwUWc&single=true&gid=0&output=csv',
  margin: {top: 40, right: 10, bottom: 20, left: 10},
  minimumGraphHeight: 420
};

var themes = {
  rainbow: {
    colorRanges: {
      'Bonus Cat': colorbrewer.Greens[5].slice(2, 5),
      'Dr. Wily': colorbrewer.Oranges[5].slice(1, 4),
      Shared: colorbrewer.YlOrRd[7].slice(0, 3),
      Hostility: ['#f21', '#f30']
    },
    stroke: 'none',
    textColor: {
      'Bonus Cat': '#fff',
      'Dr. Wily': '#333',
      Shared: '#333'
    }
  },
  blackandwhite: {
    colorRanges: {
      'Bonus Cat': ['#fff', '#fff', '#fff'],
      'Dr. Wily': ['#181810', '#181810', '#181810', '#181810', '#181810'],
      Shared: colorbrewer.Greys[9].slice(4, 7),
      Hostility: ['#f21', '#f30']      
    },
    stroke: '#333',
    textColor: {
      'Bonus Cat': '#333',
      'Dr. Wily': '#fff',
      Shared: '#fff'
    }
  }
}

var selectedTheme = 'rainbow';

function fetchDateOfLastEvent(csvRows, eventName) {
  var date = null;
  // csvRows are in ascending date order.
  for (var i = csvRows.length - 1; i >= 0; --i) {
    if (parseInt(csvRows[i][eventName]) > 0) {
      date = parseMMDDYY(csvRows[i]['Date']);
      break;
    }
  }
  return date;
}

function daysSinceDate(pastDate) {
  var days = 0;
  if (pastDate) {
    days = 
      ~~(
        (Date.now() - pastDate.getTime())/(24 * 60 * 60 * 1000)
      );
  }
  return days;
}

function onGettingCSV(error, rows) {
  console.log(rows);
  Session.csvArraysForColumns = csvRowObjectsToArrayDict(rows);
  var csvArrays = _.values(Session.csvArraysForColumns);
  console.log('csvArrays', csvArrays);
  setUpGraph(csvArrays);

  $('#dateoflastattack').text(daysSinceDate(
      fetchDateOfLastEvent(rows, 'Hostility: Wily Attack')
    )
  );
  $('#dateoflasthiss').text(daysSinceDate(
      fetchDateOfLastEvent(rows, 'Hostility: Bonus Hiss')
    )
  );

  var graphGroup = d3.select('g#graphGroup');
  BoardZoomer.setUpZoomOnBoard(d3.select('svg#graph'), graphGroup);

  setTimeout(function initialZoom() {
    if (location.hash) {
      $spotlightRect = $(location.hash);
      focusOnRect($spotlightRect);
    }
    else {
      var graphEl = d3.select('#graph').node();
      var lastBarX = 
        Session.xAxisDateStrings.length * Settings.stackedBarWidth;
      var panX = -lastBarX + graphEl.clientWidth - Settings.stackedBarWidth;

      var xAxisGroup = graphGroup.select('.x.axis');
      var axisTransform = 
        BoardZoomer.parseScaleAndTranslateFromTransformString(
          xAxisGroup.attr('transform')
        );
      var axisY = axisTransform.translate[1];
      var panY = -axisY + graphEl.clientHeight 
        - xAxisGroup.node().getBoundingClientRect().height;

      BoardZoomer.tweenToNewZoom(1.0, [panX, panY], 750);
    }
  },
  3000);

  $('.attackspotlighttrigger').on('click', function() {
    var attackRect = _.last(_.filter($('[id|="HostilityWilyAttack"]'), 
      function heightIsNonZero(rect) { 
        return (rect.getAttribute('height') > 0); 
      })
    );

    focusOnRect($(attackRect));      
  });

  $('.hissspotlighttrigger').on('click', function() {
    var attackRect = _.last(_.filter($('[id|="HostilityBonusHiss"]'), 
      function heightIsNonZero(rect) { 
        return (rect.getAttribute('height') > 0); 
      })
    );

    focusOnRect($(attackRect));      
  });

}

d3.csv(Settings.csvUrl, onGettingCSV);

function csvRowObjectsToArrayDict(rows) {
  var groupsForGroupNames = {};
  var columnNames = [];
  var sortedColumnNames = [];
  var groupMetadataForColumnNames = {};

  if (rows.length < 1 || rows[0].length < 3) {
    return groups;
  }
  else {
    columnNames = (_.keys(_.omit(rows[0], 'Date')));

    groupMetadataForColumnNames = _.object(columnNames, 
      _.map(columnNames, function getMetadataForColumnName(columnName) {
        var category = null;
        var activity = null;
        var parts = columnName.split(': ');
        if (parts.length > 1) {
          category = parts[0];
          activity = parts[1];
        }
        var categorySortOrder = -1;
        if (category) {
          categorySortOrder = Settings.preferredCategoryOrder.indexOf(category);
        }
        if (categorySortOrder < 0) {
          // If we don't know how to sort it, but it at the end.
          categorySortOrder = 1000;
        }

        var activitySortOrder = -1;
        if (activity) {
          activitySortOrder = 
            Settings.preferredActivityOrders[category].indexOf(activity);
        }
        if (activitySortOrder < 0) {
          // If we don't know how to sort it, but it at the end.
          activitySortOrder = 999;
        }
        return {
          category: category,
          activity: activity,
          categorySortOrder: categorySortOrder,
          activitySortOrder: activitySortOrder
        };
      })
    );

    sortedColumnNames = _.sortBy(columnNames, function sortColumn(columnName) {
      var metadata = groupMetadataForColumnNames[columnName];
      return metadata.categorySortOrder * 1000 + metadata.activitySortOrder;
    });

    _.each(sortedColumnNames, function initGroupArray(groupKey) {
      groupsForGroupNames[groupKey] = [];
    });

    var startDate = new Date(rows[0].Date);
    var startTime = startDate.getTime();

    _.each(rows, function arrayFromRowObject(row) {
      var xDate = new Date(row.Date);
      var xTime = xDate.getTime();
      var daysElapsed = (xTime - startTime)/1000/(24 * 60 * 60);

      // SIDE EFFECT! Save the date string so the axis can use it later.
      graphSession.xAxisDateStrings.push(xDate.toDateString());

      var currentCategory = null;
      var numberOfKeysInCategoryProcessed = 0;

      _.each(sortedColumnNames, function putRowContentsIntoArrays(columnName) {
        var columnMetadata = groupMetadataForColumnNames[columnName];

        groupsForGroupNames[columnName].push({
          x: daysElapsed,
          y: row[columnName] ? parseFloat(row[columnName]) : 0,
          y0: sortedColumnNames.indexOf(columnName),
          category: columnMetadata.category,
          activity: columnMetadata.activity,
          columnName: columnName,
          id: sanitizeAsId(columnName) + '-' + xTime,
          activitySortOrder: columnMetadata.activitySortOrder,
          getLabelText: function getText(d) {
            var text = null;
            if (this.y > 0.01) {
              text = this.activity;
            }
            return text;
          }
        });
      })
    });
  }
  return groupsForGroupNames;
}

// Set up color generating functions.

var bonusColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges['Bonus Cat']);

var wilyColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges['Dr. Wily']);

var sharedColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges.Shared);

var hostilityColor = d3.scale.ordinal().range(
  themes[selectedTheme].colorRanges.Hostility);

function getFillForLayerGroup(d) { 
  var calculated = '#f0f';
  var representatitveCell = d[0];

  if (representatitveCell && 
    (typeof representatitveCell.category === 'string')) {
    switch (representatitveCell.category) {
      case 'Bonus Cat':
        calculated = bonusColor(representatitveCell.activitySortOrder);
        break;
      case 'Dr. Wily':
        calculated = wilyColor(representatitveCell.activitySortOrder);
        break;
      case 'Shared':
        calculated = sharedColor(representatitveCell.activitySortOrder);
        break;
      case 'Hostility':
        calculated = hostilityColor(representatitveCell.activitySortOrder);
        break;
      default:
        console.log('Could not find a color for', representatitveCell);
        // debugger;
    }
  }
  else {
    debugger;
  }

  if (Session.spotlightedLayer && Session.spotlightedLayer !== d) {
    // Shade the color to make it darker.    
    calculated = d3.rgb(calculated).darker(3.5).toString();
  }

  return calculated; 
}

function setUpLegend(parentSelString, colors) {
  d3.select(parentSelString).select('g').selectAll('rect')
  .data(colors)
  .enter()
  .append('rect')  
  .attr('width', 20)
  .attr('height', 30)
  .attr('fill', function getFill(d) { return d; })
  .attr('y', 0)
  .attr('x', function(d, i) { return i * 20; });
}

setUpLegend('#bonuscat-legend', bonusColor.range());
setUpLegend('#drwily-legend', wilyColor.range());
setUpLegend('#shared-legend', sharedColor.range());



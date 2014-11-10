$(document).ready(function () { 

    $.ajax({
        url: "api",
        type: "GET",
        dataType: 'json',
        success: function (data) {
            formatted_data = formatData(data.data);
            var chart = new O_o.Chart(formatted_data, { container: '#tweet_chart', tooltip_font_size: 12 });
        },
        error: function (xhr, status, err) {
            console.log('Error', status, err);
        }
    });

    var datasets = {};
    function formatData(data) {
        _.each(data, function (datum) {
            if (!datasets[datum.user]) {
                var id = Number(_.uniqueId())
                datasets[datum.user] = {
                    name: '<a href="https://twitter.com/' + datum.user + '">@' + datum.user + '</a>',
                    x: [datetimeToX(datum.created_at)],
                    y: [id],
                    meta: ['@' + datum.user + ': ' + datum.text],
                    id: id
                }
            } else {
                datasets[datum.user].x.unshift(datetimeToX(datum.created_at));
                datasets[datum.user].y.unshift(datasets[datum.user].id);
                datasets[datum.user].meta.unshift('@' + datum.user + ': ' + datum.text);
            }
        })
        return {
            labels: _.map(_.range(25), function (i) {
                var new_time = moment("Thu Nov 06 16:00:00 +0000 2014").add(4 * i, 'hours');
                return {
                    x: datetimeToX(new_time.format()),
                    label: new_time.format('MMM Do YYYY, ha')
                };
            }),
            datasets: _.map(datasets, function(v) { return v; })
        };
    }

  function datetimeToX(datetime) {
    var begin_time = (new Date("Thu Nov 06 16:00:00 +0000 2014")).getTime();
    var end_time = (new Date("Sat Nov 08 20:00:00 +0000 2014")).getTime();
    return ((new Date(datetime)).getTime() - begin_time )/(end_time - begin_time) * 100;
  }

});

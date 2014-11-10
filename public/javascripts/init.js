$(document).ready(function () { 

	$.ajax({
        url: "api",
        type: "GET",
        dataType: 'json',
        success: function (data) {
            console.log(data)
        },
        error: function (xhr, status, err) {
            console.log('Error', status, err);
        }
    });

});

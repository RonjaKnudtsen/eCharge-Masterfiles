// Create global variables to hold coordinates and the map.
var _my_module_user_latitude = null;
var _my_module_user_longitude = null;
var _my_module_map = null;
var _my_markers = {};

/**
 * Implements hook_menu().
 */
function my_module_menu() {
  var items = {};
  items['ladestasjon/%'] = {
    title: 'ladestasjon',
    page_callback: 'node_page',
    page_arguments: [1],
    pageshow: 'node_pageshow'
  };
  items['ladestasjon'] = {
    title: 'Kart over ladestasjoner',
    page_callback: 'my_module_ladestasjon',
    pageshow: 'my_module_ladestasjon_pageshow'
  };
  return items;
}

function ladestasjon_page(nid){
  var content ={}
  content['my_markup'] = {
    markup: '<div id="testme"></div>'
  };
  return content;
}

function ladestasjon_pageshow(nid){
  node_load(nid, {
    success: function(node){
      console.log("NID: "+nid);
    }
  })
  runWebsocketServer();
}


/*
* Helper function which loads a websocket server
*/
 function runWebsocketServer(){
  //Check if websocket is supported by the browser.
  if ("WebSocket" in window){
     
     // Open a new web socket
     var ws = new WebSocket("ws://realtime.nobil.no/api/v1/stream?apikey=a1060d7d9c5a88b1a55e1a1a7cd6dacb");
     
     var chargingStations = {};
     var i = 0;

     //on websocket message
     ws.onmessage = function (evt){ 
        message = jQuery.parseJSON(evt.data);

        //If snapshot is initialized        
        if(message.type==="snapshot:init"){

          //Iterate over the data. 
          for(var i in message.data){

            var id = message.data[i].uuid;
            if(typeof _my_markers[id] != 'undefined'){
              //Set the marker as busy (red)
               _my_markers[id].setIcon("http://maps.gstatic.com/mapfiles/markers2/marker.png");

              //Iterate through all connectors to see if one or more is available
               for(var j = 0; j < message.data[i].connectors.length; j++){
                //If more than one is available, mark marker as available. (green)
                if(message.data[i].connectors[j].status == 0){
                  _my_markers[id].setIcon("http://maps.gstatic.com/mapfiles/markers2/icon_green.png"); 
                }
               }             
            }
          }
        }
     };
  } else {
     // The browser doesn't support WebSocket
     alert("WebSocket NOT supported by your Browser!");
  }  
}


/**
 * The callback for the "Hello World" page.
 */
function my_module_hello_world_page() {
  var content = {};
  content['box'] = {
    markup: '<div id ="super-box"></div>'
  }
  content['my_button'] = {
    theme: 'button',
    text: 'Hello World',
    attributes: {
      onclick: "drupalgap_alert('Hi!')"
    }
  };
  return content;
}

function my_module_ladestasjon(){
  try {
    var content = {};
    var map_attributes = {
      id: 'my_module_map',
      style: 'width: 100%; height: 320px;'
    };
    content['map'] = {
      markup: '<div '+ drupalgap_attributes(map_attributes) + '></div>'
    };
    content['find_nearby_locations'] = {
      theme: 'button',
      text: 'Find Nearby Locations',
      attributes: {
        onclick: "_my_module_ladestasjon_button_click()",
        'data-theme': 'b'
      }
    };
    content['location_results'] = {
      theme: 'jqm_item_list',
      items: [],
      attributes: {
        id: 'location_results_list',
        'data-filter':'true',
      }
    };
    return content;
  } catch(error){console.log('my_module_ladestasjon - '+ error);}
}

function my_module_ladestasjon_pageshow(){
  //Should later be get geolocation.    
  _my_module_user_longitude = 59.942943 ;
  _my_module_user_latitude = 10.716970 ;

  //ifi: 59.942943 10.716970 
  //Kristiansund 63.110335 7.728079
  //Dovre: 62.074859 9.536018 

  //Make a google map latlng. 
  var myLatlng = new google.maps.LatLng(
    _my_module_user_longitude,
    _my_module_user_latitude
  );
        
  // Set the options to center the map around the user.
  var mapOptions = {
    center: myLatlng,
    zoom: 11,
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
    },
    zoomControl: true,
    zoomControlOptions: {
      style: google.maps.ZoomControlStyle.SMALL
    }
  };

  // Initialize the map, and set a timeout to resize properly.
  _my_module_map = new google.maps.Map(
    document.getElementById("my_module_map"),
    mapOptions
  );

  setTimeout(function() {
      google.maps.event.trigger(_my_module_map, 'resize');
      _my_module_map.setCenter(myLatlng);
  }, 500);
  
  // Add a marker for the user's current position.
  var marker = new google.maps.Marker({
      position: myLatlng,
      map: _my_module_map,
      icon: 'http://maps.gstatic.com/mapfiles/markers2/drag_cross_67_16.png'
  });
  

}


/**
 * The "Find Nearby Locations" click handler.
 */
function _my_module_ladestasjon_button_click() {
  try {
    // Build the path to the view to retrieve the results.
    // var range = 1; 
    var range = 10;
    var path = 'nearby-charging-stations/' + _my_module_user_longitude  + ',' +_my_module_user_latitude+ '_' + range;      
    var counter = 0;
    var bounds = new google.maps.LatLngBounds();

    populate_map(path, range, counter, bounds);

  } catch(error){
    console.log('_my_module_ladestasjon_button_click - ' + error); 
  }
}

//Recursive function; takes a path, range, counter and bounds.
function populate_map(path, range, counter, bounds){
  //Views datasource. Recieves json result of nearby charging stations.
  views_datasource_get_view_result(path, {
    success: function(data) { 

    //Range starts out low and will increase with 5 km until we have at least 10 charging stations, but before 5 iterations. 
    if (data.nodes.length < 10 && counter < 5) {    
        counter ++;
        range += 10;
        //Generate a new path with new range. 
        var path = 'nearby-charging-stations/' + _my_module_user_longitude  + ',' +_my_module_user_latitude+ '_' + range;
        //Recursion
        populate_map(path, range, counter);        
        return "no_location";
      } else if(data.nodes.length < 1){
        //Recursion stops
        //Counter has gone beyond 5 and we still have no charging stations. 
        alert("Sorry, we did not seem to find any charging stations near you."); 
      } else {
        //Recursion stops
        //Success, here we populate the map from note items.
        var items = [];
        //For each of the node items, populate map:
        $.each(data.nodes, function(index, object) {
        var row = object.node;        
        var distance =
        row.field_geofield_distance + ' ' +
        drupalgap_format_plural(row.field_geofield_distance, 'km', 'km');

        //Translation

        var data = "<b>"+row.number_of_charging_points+"</b> ladepunkter, "; 
        if(row.parking_fee=="Yes"){data += "<b>parkeringsavgift</b>, "};
        if(row.time_limit=="Yes"){data += "</b>tidsbegrensning</b>, "};
        if(row.twentyfourhrs=="Yes"){data += "<b>døgnåpent</b>, "};
        
        data += "tilgjengelighet: <b><i>"+row.availability.toLowerCase()+"</i></b>" ;

        var description =
          '<h2>' + row.title + " - "+ distance + '</h2>' +
          '<p>' + data + '</p>';
        var link = l(description, 'node/' + row.nid);
        items.push(link);
        
        // Add a marker on the map for the location.
        var locationStaLatlng = new google.maps.LatLng(row.latitude, row.longitude);
        
        var marker = new google.maps.Marker({
            position: locationStaLatlng,
            animation: google.maps.Animation.DROP,
            map: _my_module_map,
            icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            data: row
        });

        marker.addListener('click', function(){
          console.log("Clicked");
          console.log(node);
        });
        //Add the new marker to the array list. 
        var landcode = "NOR_"+row.charging_station_ID;
        _my_markers[landcode] = marker;


        bounds.extend(marker.getPosition());
        
         

      });

      _my_module_map.fitBounds(bounds);
      runWebsocketServer();
      drupalgap_item_list_populate("#location_results_list", items);
      return "Success";
      
      }
    }
    });
}

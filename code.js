//The full code and the variables of the polygons needed to run the code can be accessed via this link
var link = 'https://code.earthengine.google.com/7d393dfdcaad646a906c176289e6f633';


function maskClouds(image){
    var qa = image.select('QA60');
    //Bits 10 and 11 are clouds and cirrus
    var cloudBitMask = 1<< 10;
    var cirrusBitMask = 1<< 11;
    // both masks should be set to zero to get clear conditions
    var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0))
    
    return image.updateMask(mask).divide(10000);
  }
  
  var sentinel_2 = ee.ImageCollection("COPERNICUS/S2")
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
  .filterDate('2019-11-01', '2020-11-01')
  .filterBounds(roi1).map(maskClouds).median();
  
  
  //image style
  var rgbVis = {
    min: 0.04,
    max: 0.39,
    bands:['B11','B8','B4']
  };
  
  var ndvi = sentinel_2.expression('(NIR - Red)/ (NIR + Red)', {
              'NIR': sentinel_2.select('B8'),
              'Red': sentinel_2.select('B4')
  });
  
  var ndwi = sentinel_2.expression('(Green - NIR)/ (Green + NIR)', {
              'NIR': sentinel_2.select('B8'),
              'Green': sentinel_2.select('B3')
  });
  
  var savi = sentinel_2.expression('((NIR - Red)/ (NIR + Red + 0.5)) * (1.0 + 0.5)', {
              'NIR': sentinel_2.select('B8'),
              'Red': sentinel_2.select('B4')
  });
  
  //additional bands to the final image
  var final_image = sentinel_2.addBands(ndvi.rename('NDVI'))
                              .addBands(ndwi.rename('NDWI'))
                              .addBands(savi.rename('SAVI'))
  
  //Bands for prediction
  
  var bands = ['B2','B3','B4','B5','B8','B9','B11','NDVI','NDWI','SAVI']
  
  //print(final_image);
  Map.addLayer(final_image.clip(roi1), rgbVis, 'spImage')
  
  var samples = farmland.merge(forest).merge(Plain_land)
  //print(samples.size())
  var labels = ['id']
  var total_sample = final_image.select(bands).sampleRegions({
    collection: samples,
    properties: labels,
    scale: 30
  });
  
  //print(training.size())
  
  var classifier = ee.Classifier.smileRandomForest(15).train({
    features: total_sample,
    classProperty:'id',
    inputProperties: bands
  });
  
  var classification = final_image.select(bands).classify(classifier);
  
  Map.addLayer(classification.clip(roi1), lcstyle, 'Classification');
  
  //Accuracy
  var sample_arc = total_sample.randomColumn('rand');
  var training = sample_arc.filter(ee.Filter.lt('rand', 0.7));
  var validation = sample_arc.filter(ee.Filter.gte('rand', 0.7));
  
  var classifier = ee.Classifier.smileRandomForest(15).train({
    features: training,
    classProperty:'id',
    inputProperties: bands
  });
  
  var confusionMatrix = ee.ConfusionMatrix(validation.classify(classifier)
                        .errorMatrix({
                            actual:'id',
                            predicted:'classification'
                          }));
  
  print('Confusion Matrix', confusionMatrix)
  print('Overall Accuracy', confusionMatrix.accuracy())
  
  
  //NDVI time series of the selected region
  
  
  var collection1 = ee.ImageCollection(noaaNDVI.filterDate('2019-11-01', '2020-11-01'));
  
  var clipped1 = collection1.mean().clip(roi1)
  
  var TS1 = ui.Chart.image.seriesByRegion(collection1, roi1, ee.Reducer.mean(),'NDVI',500,'system:time_start').setOptions({
            title:'Southern Province NDVI time series',
            vAxis: {title: 'NDVI'},
  })
  
  print(TS1);
  
  
  
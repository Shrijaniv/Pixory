Pod::Spec.new do |s|
  s.name           = 'VisionScorer'
  s.version        = '1.0.0'
  s.summary        = 'iOS Vision framework photo scoring for Pixory'
  s.description    = 'Scores photos using sharpness, face detection, and saliency via iOS Vision.'
  s.author         = { 'Pixory' => 'hello@pixory.app' }
  s.license        = { :type => 'MIT' }
  s.homepage       = 'https://github.com/pixory'
  s.platforms      = { :ios => '14.0' }
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.swift_version  = '5.9'
end

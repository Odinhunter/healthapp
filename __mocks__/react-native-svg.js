const React = require('react');

const create = (name) => {
  const Component = React.forwardRef((props, ref) =>
    React.createElement(name, { ...props, ref })
  );
  Component.displayName = name;
  return Component;
};

module.exports = {
  default: create('Svg'),
  Svg: create('Svg'),
  Circle: create('Circle'),
  Ellipse: create('Ellipse'),
  G: create('G'),
  Text: create('SvgText'),
  TSpan: create('TSpan'),
  TextPath: create('TextPath'),
  Path: create('Path'),
  Polygon: create('Polygon'),
  Polyline: create('Polyline'),
  Line: create('Line'),
  Rect: create('Rect'),
  Use: create('Use'),
  Image: create('Image'),
  Symbol: create('Symbol'),
  Defs: create('Defs'),
  LinearGradient: create('LinearGradient'),
  RadialGradient: create('RadialGradient'),
  Stop: create('Stop'),
  ClipPath: create('ClipPath'),
  Pattern: create('Pattern'),
  Mask: create('Mask'),
  Marker: create('Marker'),
  ForeignObject: create('ForeignObject'),
};

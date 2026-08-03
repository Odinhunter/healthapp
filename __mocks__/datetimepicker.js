const React = require('react');
const { View } = require('react-native');

const DateTimePicker = (props) =>
  React.createElement(View, { testID: 'date-time-picker', ...props });

module.exports = DateTimePicker;
module.exports.default = DateTimePicker;

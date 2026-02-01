// frontend/components/DateField.js
import React, { useMemo, useState } from "react";
import { Platform, Pressable, Text, View, Modal } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

let WebDatePicker = null;
if (Platform.OS === "web") {
  WebDatePicker = require("react-datepicker").default;
  require("react-datepicker/dist/react-datepicker.css");
}

export default function DateField({ label = "Date", value, onChange, stylesObj }) {
  const [open, setOpen] = useState(false);

  const dateValue = useMemo(() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  const displayText = useMemo(() => dateValue.toDateString(), [dateValue]);

  // ✅ WEB (react-datepicker)
  if (Platform.OS === "web") {
    return (
      <View style={stylesObj.fieldWrap}>
        <Text style={stylesObj.label}>{label}</Text>

        {/* IMPORTANT: overflow must be visible on web or calendar gets clipped */}
        <View style={[stylesObj.inputBox, { overflow: "visible", zIndex: 9999 }]}>
          <WebDatePicker
            selected={dateValue}
            onChange={(d) => onChange(d)}
            dateFormat="EEE MMM dd yyyy"
            popperPlacement="bottom-start"
            popperClassName="rnWebDatePopper"
            portalId="root" // helps render above RN layers on web
          />
        </View>

        {/* Force calendar popup above everything */}
        <style>{`
          .rnWebDatePopper { z-index: 999999 !important; }
          .react-datepicker-popper { z-index: 999999 !important; }
          .react-datepicker { font-family: inherit; }
          .react-datepicker__triangle { display: none; }

          /* Input styling (react-datepicker creates its own input) */
          .react-datepicker-wrapper { width: 100%; }
          .react-datepicker__input-container { width: 100%; }
          .react-datepicker__input-container input {
            width: 100%;
            background: transparent;
            border: none;
            outline: none;
            color: inherit;
            font-size: 14px;
            padding: 14px 12px;
          }
        `}</style>
      </View>
    );
  }

  // ✅ ANDROID + IOS
  return (
    <View style={stylesObj.fieldWrap}>
      <Text style={stylesObj.label}>{label}</Text>

      <Pressable onPress={() => setOpen(true)} style={stylesObj.inputBox}>
        <Text style={stylesObj.inputText}>{displayText}</Text>
      </Pressable>

      {Platform.OS === "android" && open && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="calendar"
          onChange={(event, selectedDate) => {
            setOpen(false);
            if (event?.type === "dismissed") return;
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}

      {Platform.OS === "ios" && (
        <Modal visible={open} transparent animationType="fade">
          <Pressable style={stylesObj.modalBackdrop} onPress={() => setOpen(false)} />
          <View style={stylesObj.modalCard}>
            <DateTimePicker
              value={dateValue}
              mode="date"
              display="inline"
              onChange={(event, selectedDate) => {
                if (selectedDate) onChange(selectedDate);
              }}
            />
            <Pressable style={stylesObj.modalDone} onPress={() => setOpen(false)}>
              <Text style={stylesObj.modalDoneText}>Done</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
}

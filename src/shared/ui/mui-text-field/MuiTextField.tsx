'use client';

import TextField, { type TextFieldProps } from '@mui/material/TextField';

export default function MuiTextField(props: TextFieldProps) {
  return <TextField variant="outlined" size="small" fullWidth {...props} />;
}

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { ColorPicker } from '../components/ColorPicker';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface SettingsPageProps { }

const SettingsPage: React.FC<SettingsPageProps> = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState('');
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
    } else {
      setFormData({});
    }
  }, [editingItem]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
      setLoading(false);
    } catch (error) {
      enqueueSnackbar('Error loading settings', { variant: 'error' });
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSettingChange = async (category: string, key: string, value: any) => {
    try {
      const response = await fetch(`/api/settings/${category}/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (response.ok) {
        setSettings((prev: any) => ({
          ...prev,
          [category]: { ...prev[category], [key]: value },
        }));
        enqueueSnackbar('Setting updated successfully', { variant: 'success' });
      }
    } catch (error) {
      enqueueSnackbar('Error updating setting', { variant: 'error' });
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddItem = (category: string) => {
    setEditingCategory(category);
    setEditingItem(null);
    setEditDialogOpen(true);
  };

  const handleEditItem = (category: string, item: any) => {
    setEditingCategory(category);
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  const handleDeleteItem = async (category: string, itemId: string) => {
    try {
      const response = await fetch(`/api/settings/${category}/${itemId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchSettings();
        enqueueSnackbar('Item deleted successfully', { variant: 'success' });
      }
    } catch (error) {
      enqueueSnackbar('Error deleting item', { variant: 'error' });
    }
  };

  const handleSaveItem = async (formData: any) => {
    try {
      const category = editingCategory;
      const items = [...((settings[category]?.[category]) || [])];

      if (editingItem) {
        const index = items.findIndex((item: any) => item.id === editingItem.id);
        items[index] = { ...editingItem, ...formData };
      } else {
        items.push({ ...formData, id: Date.now().toString() });
      }

      await handleSettingChange(category, category, items);
      setEditDialogOpen(false);
    } catch (error) {
      enqueueSnackbar('Error saving item', { variant: 'error' });
    }
  };

  const renderGeneralSettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Company Name"
          value={settings.general?.company_name || ''}
          onChange={(e) => handleSettingChange('general', 'company_name', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Store Name"
          value={settings.general?.store_name || ''}
          onChange={(e) => handleSettingChange('general', 'store_name', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Timezone</InputLabel>
          <Select
            value={settings.general?.timezone || 'Europe/Berlin'}
            onChange={(e) => handleSettingChange('general', 'timezone', e.target.value)}
          >
            <MenuItem value="Europe/Berlin">Europe/Berlin</MenuItem>
            <MenuItem value="Europe/London">Europe/London</MenuItem>
            <MenuItem value="Europe/Paris">Europe/Paris</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Language</InputLabel>
          <Select
            value={settings.general?.language || 'de'}
            onChange={(e) => handleSettingChange('general', 'language', e.target.value)}
          >
            <MenuItem value="de">Deutsch</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );

  const renderSchedulingSettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          type="number"
          label="Default Shift Duration (hours)"
          value={settings.scheduling?.default_shift_duration || 8}
          onChange={(e) => handleSettingChange('scheduling', 'default_shift_duration', Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          type="number"
          label="Minimum Break Duration (minutes)"
          value={settings.scheduling?.min_break_duration || 30}
          onChange={(e) => handleSettingChange('scheduling', 'min_break_duration', Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={settings.scheduling?.auto_schedule_preferences || false}
              onChange={(e) => handleSettingChange('scheduling', 'auto_schedule_preferences', e.target.checked)}
            />
          }
          label="Enable Automatic Schedule Preferences"
        />
      </Grid>
    </Grid>
  );

  const renderShiftTypes = () => (
    <Box>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => handleAddItem('shift_types')}
        sx={{ mb: 2 }}
      >
        Add Shift Type
      </Button>
      <Grid container spacing={2}>
        {(settings.shift_types?.shift_types || []).map((type: any) => (
          <Grid item xs={12} md={4} key={type.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{type.name}</Typography>
                <Typography color="textSecondary">
                  {type.start_time} - {type.end_time}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      backgroundColor: type.color,
                      borderRadius: '50%',
                      display: 'inline-block',
                    }}
                  />
                </Box>
              </CardContent>
              <CardActions>
                <IconButton onClick={() => handleEditItem('shift_types', type)}>
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => handleDeleteItem('shift_types', type.id)}>
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderEmployeeTypes = () => (
    <Box>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => handleAddItem('employee_types')}
        sx={{ mb: 2 }}
      >
        Add Employee Type
      </Button>
      <Grid container spacing={2}>
        {(settings.employee_types?.employee_types || []).map((type: any) => (
          <Grid item xs={12} md={4} key={type.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{type.name}</Typography>
                <Typography color="textSecondary">
                  {type.min_hours} - {type.max_hours} hours
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton onClick={() => handleEditItem('employee_types', type)}>
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => handleDeleteItem('employee_types', type.id)}>
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderAbsenceTypes = () => (
    <Box>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => handleAddItem('absence_types')}
        sx={{ mb: 2 }}
      >
        Add Absence Type
      </Button>
      <Grid container spacing={2}>
        {(settings.absence_types?.absence_types || []).map((type: any) => (
          <Grid item xs={12} md={4} key={type.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{type.name}</Typography>
                <Box sx={{ mt: 1 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      backgroundColor: type.color,
                      borderRadius: '50%',
                      display: 'inline-block',
                      marginRight: 8,
                    }}
                  />
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    component="span"
                  >
                    {type.paid ? 'Paid' : 'Unpaid'}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions>
                <IconButton onClick={() => handleEditItem('absence_types', type)}>
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => handleDeleteItem('absence_types', type.id)}>
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderDisplaySettings = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Theme</InputLabel>
          <Select
            value={settings.display?.theme || 'light'}
            onChange={(e) => handleSettingChange('display', 'theme', e.target.value)}
          >
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
            <MenuItem value="system">System</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Start of Week</InputLabel>
          <Select
            value={settings.display?.start_of_week || 1}
            onChange={(e) => handleSettingChange('display', 'start_of_week', Number(e.target.value))}
          >
            <MenuItem value={1}>Monday</MenuItem>
            <MenuItem value={0}>Sunday</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={settings.display?.show_weekends || true}
              onChange={(e) => handleSettingChange('display', 'show_weekends', e.target.checked)}
            />
          }
          label="Show Weekends"
        />
      </Grid>
    </Grid>
  );

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Settings
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="General" />
          <Tab label="Scheduling" />
          <Tab label="Shift Types" />
          <Tab label="Employee Types" />
          <Tab label="Absence Types" />
          <Tab label="Display" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {renderGeneralSettings()}
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          {renderSchedulingSettings()}
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          {renderShiftTypes()}
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          {renderEmployeeTypes()}
        </TabPanel>
        <TabPanel value={activeTab} index={4}>
          {renderAbsenceTypes()}
        </TabPanel>
        <TabPanel value={activeTab} index={5}>
          {renderDisplaySettings()}
        </TabPanel>
      </Paper>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>
          {editingItem ? 'Edit Item' : 'Add New Item'}
        </DialogTitle>
        <DialogContent>
          {editingCategory === 'shift_types' && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Start Time"
                type="time"
                value={formData.start_time || '09:00'}
                onChange={(e) => handleInputChange('start_time', e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="End Time"
                type="time"
                value={formData.end_time || '17:00'}
                onChange={(e) => handleInputChange('end_time', e.target.value)}
                sx={{ mb: 2 }}
              />
              <ColorPicker
                defaultValue={formData.color || '#1976D2'}
                onChange={(color: string) => handleInputChange('color', color)}
              />
            </Box>
          )}
          {editingCategory === 'employee_types' && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                type="number"
                label="Minimum Hours per Week"
                value={formData.min_hours || ''}
                onChange={(e) => handleInputChange('min_hours', Number(e.target.value))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                type="number"
                label="Maximum Hours per Week"
                value={formData.max_hours || ''}
                onChange={(e) => handleInputChange('max_hours', Number(e.target.value))}
                sx={{ mb: 2 }}
              />
            </Box>
          )}
          {editingCategory === 'absence_types' && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.paid || false}
                    onChange={(e) => handleInputChange('paid', e.target.checked)}
                  />
                }
                label="Paid Absence"
                sx={{ mb: 2 }}
              />
              <ColorPicker
                defaultValue={formData.color || '#1976D2'}
                onChange={(color: string) => handleInputChange('color', color)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSaveItem(formData)} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SettingsPage; 
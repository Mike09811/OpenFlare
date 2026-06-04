package controller

import (
	"openflare/service"

	"github.com/gin-gonic/gin"
)

// GetProxyRoutes godoc
// @Summary List proxy routes
// @Tags ProxyRoutes
// @Produce json
// @Security OpenFlareTokenAuth
// @Success 200 {object} map[string]interface{}
// @Router /api/proxy-routes/ [get]
func GetProxyRoutes(c *gin.Context) {
	routes, err := service.ListProxyRoutes()
	if err != nil {
		respondFailure(c, err.Error())
		return
	}
	respondSuccess(c, routes)
}

// GetProxyRoute godoc
// @Summary Get proxy route detail
// @Tags ProxyRoutes
// @Produce json
// @Security OpenFlareTokenAuth
// @Param id path int true "Route ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/proxy-routes/{id} [get]
func GetProxyRoute(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}
	route, err := service.GetProxyRoute(id)
	if err != nil {
		respondFailure(c, err.Error())
		return
	}
	respondSuccess(c, route)
}

// CreateProxyRoute godoc
// @Summary Create proxy route
// @Tags ProxyRoutes
// @Accept json
// @Produce json
// @Security OpenFlareTokenAuth
// @Param payload body service.ProxyRouteInput true "Proxy route payload"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/proxy-routes/ [post]
func CreateProxyRoute(c *gin.Context) {
	var input service.ProxyRouteInput
	if !bindJSON(c, &input) {
		return
	}
	route, err := service.CreateProxyRoute(input)
	if err != nil {
		respondFailure(c, err.Error())
		return
	}
	respondSuccess(c, route)
}

// UpdateProxyRoute godoc
// @Summary Update proxy route
// @Tags ProxyRoutes
// @Accept json
// @Produce json
// @Security OpenFlareTokenAuth
// @Param id path int true "Route ID"
// @Param payload body service.ProxyRouteInput true "Proxy route payload"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/proxy-routes/{id}/update [post]
func UpdateProxyRoute(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}
	var input service.ProxyRouteInput
	if !bindJSON(c, &input) {
		return
	}
	route, err := service.UpdateProxyRoute(id, input)
	if err != nil {
		respondFailure(c, err.Error())
		return
	}
	respondSuccess(c, route)
}

// DeleteProxyRoute godoc
// @Summary Delete proxy route
// @Tags ProxyRoutes
// @Produce json
// @Security OpenFlareTokenAuth
// @Param id path int true "Route ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/proxy-routes/{id}/delete [post]
func DeleteProxyRoute(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}
	if err := service.DeleteProxyRoute(id); err != nil {
		respondFailure(c, err.Error())
		return
	}
	respondSuccess(c, nil)
}

package controller

import (
	"openflare/service"

	"github.com/gin-gonic/gin"
)

// CleanupDatabaseObservability godoc
// @Summary Cleanup observability tables
// @Tags Options
// @Accept json
// @Produce json
// @Security OpenFlareTokenAuth
// @Success 200 {object} map[string]interface{}
// @Router /api/option/database/cleanup [post]
func CleanupDatabaseObservability(c *gin.Context) {
	var input service.DatabaseCleanupInput
	if err := decodeOptionalJSONBody(c.Request.Body, &input); err != nil {
		respondBadRequest(c, "")
		return
	}
	result, err := service.CleanupDatabaseObservability(input)
	if err != nil {
		respondFailure(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
